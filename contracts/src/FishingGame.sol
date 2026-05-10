// 模式1: 钓鱼系统
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";

contract FishingGame is VRFConsumerBaseV2Plus, ReentrancyGuard{

    // ─── 枚举 ─────────────────────────────────────────── 
    enum RoomStatus { Waiting, Active, Finished }
    enum RoomTier   { Bronze, Silver, Gold, Diamond }

    // ─── 房间结构体 ──────────────────────────────────────
    struct Room {
        uint256 roomId;
        RoomTier tier;
        RoomStatus status;
        address[4] players;       // 最多4名玩家
        uint8 playerCount;
        uint256 entryFee;         // 入场费（wei）
        uint256 recastFee;        // re-cast追加费
        uint256 totalPot;         // 当前总奖池
        bool isPublic;            // true=开放房间 false=私人房间
        bool isLivestream;        // 是否开放观众直播
        address host;             // 房主
    }

    // ─── 状态变量 ────────────────────────────────────────
    uint256 public roomCount;
    mapping(uint256 => Room) public rooms;

    // ─── VRF 配置 ───
    IVRFCoordinatorV2Plus private immutable i_vrfCoordinator;
    bytes32 public s_keyHash;
    uint256 public s_subscriptionId;
    uint16  public constant REQUEST_CONFIRMATIONS = 3;
    uint32  public constant CALLBACK_GAS_LIMIT    = 300_000;
    uint32  public constant NUM_WORDS             = 3; // 鱼类、重量、稀有度各一个

    // ─── VRF 请求追踪 ───
    struct VRFRequest {
        uint256 roomId;
        address player;
        uint8   castCount; // 第几次抛竿
    }
    mapping(uint256 => VRFRequest) public vrfRequests; // requestId => VRFRequest

    // ─── 玩家回合状态 ────────────────────────────────────
    struct PlayerState {
        uint8   castCount;        // 已投注次数（1-4）
        bool    lockedIn;         // 是否已锁定结果
        uint256 pendingRequestId; // 等待VRF回调的requestId（0=无）
    }
    mapping(uint256 => mapping(address => PlayerState)) public playerStates;
    // roomId => player => PlayerState

    // ─── 事件 ────────────────────────────────────────────
    event CastRod(uint256 indexed roomId, address indexed player, uint256 requestId);

    // ─── 房间等级对应费用（wei）─────────────────────────
    mapping(RoomTier => uint256) public entryFees;
    mapping(RoomTier => uint256) public recastFees;

    // ─── 事件 ────────────────────────────────────────────
    event RoomCreated(uint256 indexed roomId, address indexed host, RoomTier tier, bool isPublic);
    event PlayerJoined(uint256 indexed roomId, address indexed player);

    // ─── 构造函数 ────────────────────────────────────────
    constructor(
        address vrfCoordinator,
        bytes32 keyHash,
        uint256 subscriptionId
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        i_vrfCoordinator  = IVRFCoordinatorV2Plus(vrfCoordinator);
        s_keyHash         = keyHash;
        s_subscriptionId  = subscriptionId;

        entryFees[RoomTier.Bronze]  = 0.01 ether;
        entryFees[RoomTier.Silver]  = 0.05 ether;
        entryFees[RoomTier.Gold]    = 0.1 ether;
        entryFees[RoomTier.Diamond] = 0.5 ether;

        recastFees[RoomTier.Bronze]  = 0.01 ether;
        recastFees[RoomTier.Silver]  = 0.05 ether;
        recastFees[RoomTier.Gold]    = 0.1 ether;
        recastFees[RoomTier.Diamond] = 0.5 ether;
    }

    // 创建房间
    // ─── 错误定义 ────────────────────────────────────────
    error InvalidTier();
    error IncorrectEntryFee();
    error RoomNotWaiting();
    error RoomFull();
    error AlreadyInRoom();
    error NotHost();
    error NotEnoughPlayers();
    error GameNotActive();
    error PlayerLockedIn();
    error MaxCastsReached();
    error PendingVRF();
    error NotInRoom();

    // ─── createRoom ──────────────────────────────────────
    function createRoom(
        RoomTier tier,
        bool isPublic,
        bool isLivestream
    ) external payable returns (uint256 roomId) {
        // 检查入场费是否正确
        if (msg.value != entryFees[tier]) revert IncorrectEntryFee();

        roomId = roomCount++;

        Room storage room = rooms[roomId];
        room.roomId      = roomId;
        room.tier        = tier;
        room.status      = RoomStatus.Waiting;
        room.entryFee    = entryFees[tier];
        room.recastFee   = recastFees[tier];
        room.isPublic    = isPublic;
        room.isLivestream = isLivestream;
        room.host        = msg.sender;

        // 房主自动成为第一个玩家
        room.players[0]  = msg.sender;
        room.playerCount = 1;
        room.totalPot    = msg.value;

        emit RoomCreated(roomId, msg.sender, tier, isPublic);
        emit PlayerJoined(roomId, msg.sender);
    }

    // ─── VRF回调（暂时留空）─────────────────────────────
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        VRFRequest memory req = vrfRequests[requestId];  // ← 这行报错
        PlayerState storage ps = playerStates[req.roomId][req.player];
        ps.pendingRequestId = 0;
    }

    // ─── 读取房间基础信息 ─────────────────────────────────
    function getRoomInfo(uint256 roomId) external view returns (
        uint256 id,
        RoomTier tier,
        RoomStatus status,
        uint8 playerCount,
        uint256 entryFee,
        uint256 totalPot,
        bool isPublic,
        bool isLivestream,
        address host
    ) {
        Room storage room = rooms[roomId];
        return (
            room.roomId,
            room.tier,
            room.status,
            room.playerCount,
            room.entryFee,
            room.totalPot,
            room.isPublic,
            room.isLivestream,
            room.host
        );
    }

    // ─── joinRoom ────────────────────────────────────────
    function joinRoom(uint256 roomId) external payable nonReentrant {
        Room storage room = rooms[roomId];

        // 检查
        if (room.status != RoomStatus.Waiting) revert RoomNotWaiting();
        if (room.playerCount >= 4)             revert RoomFull();
        if (msg.value != room.entryFee)        revert IncorrectEntryFee();

        // 检查是否已在房间
        for (uint8 i = 0; i < room.playerCount; i++) {
            if (room.players[i] == msg.sender) revert AlreadyInRoom();
        }

        // 加入房间
        room.players[room.playerCount] = msg.sender;
        room.playerCount++;
        room.totalPot += msg.value;

        emit PlayerJoined(roomId, msg.sender);
    }

    // 房间满4人后，房主可以手动开始游戏
    // ─── 事件（补充）────────────────────────────────────
    event GameStarted(uint256 indexed roomId);

    // ─── startGame ───────────────────────────────────────
    function startGame(uint256 roomId) external {
        Room storage room = rooms[roomId];

        // 只有房主可以开始
        if (msg.sender != room.host)           revert NotHost();
        // 必须是等待状态
        if (room.status != RoomStatus.Waiting) revert RoomNotWaiting();
        // 至少2人才能开始（允许不满4人开始）
        if (room.playerCount < 2) revert NotEnoughPlayers();

        room.status = RoomStatus.Active;

        emit GameStarted(roomId);
    }

    // ─── castRod（抛竿，触发VRF）────────────────────────
    function castRod(uint256 roomId) external payable nonReentrant {
        Room storage room = rooms[roomId];
        PlayerState storage ps = playerStates[roomId][msg.sender];

        // 检查游戏状态
        if (room.status != RoomStatus.Active) revert GameNotActive();
        if (ps.lockedIn)                      revert PlayerLockedIn();
        if (ps.castCount >= 4)                revert MaxCastsReached();
        if (ps.pendingRequestId != 0)         revert PendingVRF();

        // 检查玩家是否在房间
        bool inRoom = false;
        for (uint8 i = 0; i < room.playerCount; i++) {
            if (room.players[i] == msg.sender) { inRoom = true; break; }
        }
        if (!inRoom) revert NotInRoom();

        // 第一次抛竿不需要额外付费（入场时已付）
        // Re-cast（第2次起）需要追加费用
        if (ps.castCount > 0) {
            if (msg.value != room.recastFee) revert IncorrectEntryFee();
            room.totalPot += msg.value;
        } else {
            if (msg.value != 0) revert IncorrectEntryFee();
        }

        ps.castCount++;

        // 请求VRF随机数
        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash:             s_keyHash,
            subId:               s_subscriptionId,
            requestConfirmations: REQUEST_CONFIRMATIONS,
            callbackGasLimit:    CALLBACK_GAS_LIMIT,
            numWords:            NUM_WORDS,
            extraArgs:           VRFV2PlusClient._argsToBytes(
                                    VRFV2PlusClient.ExtraArgsV1({ nativePayment: false })
                                )
        });

        uint256 requestId = i_vrfCoordinator.requestRandomWords(req);

        // 记录请求
        ps.pendingRequestId = requestId;
        vrfRequests[requestId] = VRFRequest({
            roomId:    roomId,
            player:    msg.sender,
            castCount: ps.castCount
        });

        emit CastRod(roomId, msg.sender, requestId);
    }
}