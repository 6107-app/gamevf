"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { getContract } from "./contract";

interface WalletState {
  address: string | null;
  signer: ethers.Signer | null;
  provider: ethers.BrowserProvider | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
}

const LOCAL_CHAIN_ID = 31337;
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? LOCAL_CHAIN_ID);

function lastBlockKey(chainId: number) {
  return `deepcast:lastBlock:${chainId}`;
}

function readLastBlock(chainId: number): number | null {
  try {
    if (typeof window === "undefined") return null;
    const v = window.sessionStorage.getItem(lastBlockKey(chainId));
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLastBlock(chainId: number, blockNumber: number) {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(lastBlockKey(chainId), String(blockNumber));
  } catch {}
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    signer: null,
    provider: null,
    chainId: null,
    isConnecting: false,
    error: null,
  });

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setState((s) => ({ ...s, error: "Please install MetaMask" }));
      return;
    }

    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC_URL;
      const rpcProvider = new ethers.JsonRpcProvider(rpcUrl);
      const currentBlock = await rpcProvider.getBlockNumber();

      const prevBlock = readLastBlock(chainId);
      if (prevBlock !== null && prevBlock > currentBlock) {
        writeLastBlock(chainId, currentBlock);
        // Continue without reloading to avoid interrupting UI subscriptions.
      }
      writeLastBlock(chainId, currentBlock);

      setState({
        address,
        signer,
        provider,
        chainId,
        isConnecting: false,
        error: chainId !== TARGET_CHAIN_ID ? `Current network is not chain ${TARGET_CHAIN_ID}` : null,
      });
    } catch (e: unknown) {
      const msg =
        (e as { shortMessage?: string; message?: string })?.shortMessage ||
        (e as { message?: string })?.message ||
        "Connection failed";
      setState((s) => ({ ...s, isConnecting: false, error: msg }));
    }
  }, []);

  const switchToLocalNetwork = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + TARGET_CHAIN_ID.toString(16) }],
      });
    } catch (e: unknown) {
      if ((e as { code?: number }).code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x" + TARGET_CHAIN_ID.toString(16),
              chainName: TARGET_CHAIN_ID === LOCAL_CHAIN_ID ? "Anvil Local" : `Chain ${TARGET_CHAIN_ID}`,
              rpcUrls: [TARGET_CHAIN_ID === LOCAL_CHAIN_ID ? DEFAULT_RPC_URL : "https://rpc.sepolia.org"],
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            },
          ],
        });
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((result) => {
        const accounts = result as string[];
        if (accounts.length > 0) connect();
      })
      .catch(() => {});
  }, [connect]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts || accounts.length === 0) {
        setState({ address: null, signer: null, provider: null, chainId: null, isConnecting: false, error: null });
      } else {
        connect();
      }
    };

    const handleChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [connect]);

  return { ...state, connect, switchToLocalNetwork };
}

export function useContract() {
  const wallet = useWallet();

  const getReadContract = useCallback(() => {
    if (!wallet.provider) return null;
    return getContract(wallet.provider);
  }, [wallet.provider]);

  const getRpcReadContract = useCallback(() => {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return getContract(provider);
  }, []);

  const getWriteContract = useCallback(() => {
    if (!wallet.signer) return null;
    return getContract(wallet.signer);
  }, [wallet.signer]);

  return { wallet, getReadContract, getRpcReadContract, getWriteContract };
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}
