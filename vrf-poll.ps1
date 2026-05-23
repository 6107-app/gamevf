$env:PATH = "C:\Users\Lenovo\.foundry\bin;" + $env:PATH
$VRF = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6"
$PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
$RPC = "http://127.0.0.1:8545"
while ($true) {
  for ($i = 1; $i -le 100; $i++) {
    try {
      $consumer = & cast call $VRF "consumers(uint256)(address)" $i --rpc-url $RPC 2>$null
      if ($consumer -and $consumer -ne "0x0000000000000000000000000000000000000000") {
        & cast send --private-key $PK --rpc-url $RPC $VRF "fulfill(uint256)" $i 2>$null
      }
    } catch {}
  }
  Start-Sleep -Seconds 2
}
