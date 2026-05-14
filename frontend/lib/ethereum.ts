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

const SEPOLIA_CHAIN_ID = 11155111;

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

  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + SEPOLIA_CHAIN_ID.toString(16) }],
      });
    } catch (e: unknown) {
      if ((e as { code?: number }).code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x" + SEPOLIA_CHAIN_ID.toString(16),
            chainName: "Sepolia Testnet",
            rpcUrls: ["https://rpc.sepolia.org"],
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          }],
        });
      }
    }
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

  return { ...state, connect, switchToSepolia };
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
