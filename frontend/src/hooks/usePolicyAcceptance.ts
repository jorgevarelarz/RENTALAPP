// src/hooks/usePolicyAcceptance.ts
import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const POLICY_KEY = "policy_version";

export const usePolicyAcceptance = (
  token: string | null = localStorage.getItem("token")
) => {
  const [loading, setLoading] = useState(true);
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);

  const acceptedVersion = useMemo(
    () => localStorage.getItem(POLICY_KEY),
    []
  );

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const checkPolicy = async () => {
      try {
        const res = await axios.get("/api/policies/active", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const active = res.data?.data?.find(
          (p: any) => p.policyType === "privacy_policy"
        );

        const activeVersionValue = active?.version ?? null;
        setActiveVersion(activeVersionValue);
        if (!activeVersionValue) {
          setNeedsAcceptance(false);
          return;
        }

        setNeedsAcceptance(activeVersionValue !== acceptedVersion);
      } catch (err) {
        console.error("Error checking policies:", err);
      } finally {
        setLoading(false);
      }
    };

    checkPolicy();
  }, [token, acceptedVersion]);

  const acceptPolicy = async () => {
    if (!token || !activeVersion) return;

    try {
      await axios.post(
        "/api/policies/accept",
        {
          policyType: "privacy_policy",
          policyVersion: activeVersion,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      localStorage.setItem(POLICY_KEY, activeVersion);
      setNeedsAcceptance(false);
    } catch (err) {
      console.error("Error accepting policy:", err);
    }
  };

  const hasAccepted = !needsAcceptance;

  return { loading, needsAcceptance, hasAccepted, activeVersion, acceptPolicy };
};
