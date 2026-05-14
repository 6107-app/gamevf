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
const SEPOLIA_CHAIN_ID = 11155111;
const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || SEPOLIA_CHAIN_ID;

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
      setState(s => ({ ...s, error: "请安装 MetaMask" }));
      return;
    }
    setState(s => ({ ...s, isConnecting: true, error: null }));
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      setState({
        address,
        signer,
        provider,
        chainId: Number(network.chainId),
        isConnecting: false,
        error: null,
      });
    } catch (e: unknown) {
      setState(s => ({
        ...s,
        isConnecting: false,
        error: e instanceof Error ? e.message : "连接失败",
      }));
    }
  }, []);

  const switchToLocalNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + TARGET_CHAIN_ID.toString(16) }],
      });
    } catch (e: unknown) {
      if ((e as { code?: number }).code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x" + TARGET_CHAIN_ID.toString(16),
            chainName: TARGET_CHAIN_ID === LOCAL_CHAIN_ID ? "Anvil Local" : "Sepolia Testnet",
            rpcUrls: [TARGET_CHAIN_ID === LOCAL_CHAIN_ID
              ? "http://127.0.0.1:8545"
              : "https://rpc.sepolia.org"],
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          }],
        });
      }
    }
  }, []);

  // 页面加载时自动重连
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((result) => {
        const accounts = result as string[];
        if (accounts.length > 0) {
          connect();
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        setState({ address: null, signer: null, provider: null, chainId: null, isConnecting: false, error: null });
      } else {
        connect();
      }
    };
    const handleChainChanged = () => connect();
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

  const getWriteContract = useCallback(() => {
    if (!wallet.signer) return null;
    return getContract(wallet.signer);
  }, [wallet.signer]);

  return { wallet, getReadContract, getWriteContract };
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
