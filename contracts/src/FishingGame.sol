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

    // ─── 房间等级对应费用（wei）─────────────────────────
    mapping(RoomTier => uint256) public entryFees;
    mapping(RoomTier => uint256) public recastFees;

    // ─── 事件 ────────────────────────────────────────────
    event RoomCreated(uint256 indexed roomId, address indexed host, RoomTier tier, bool isPublic);
    event PlayerJoined(uint256 indexed roomId, address indexed player);

    // ─── 构造函数 ────────────────────────────────────────
    constructor(address vrfCoordinator) 
        VRFConsumerBaseV2Plus(vrfCoordinator) 
    {
        // 设置各等级入场费
        entryFees[RoomTier.Bronze]  = 0.01 ether;
        entryFees[RoomTier.Silver]  = 0.05 ether;
        entryFees[RoomTier.Gold]    = 0.1 ether;
        entryFees[RoomTier.Diamond] = 0.5 ether;

        // re-cast费用与入场费相同
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
    ) internal override {}

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
}