// src/hooks/usePolicyAcceptance.ts
import { useEffect, useState } from "react";
import axios from "axios";

const POLICY_VERSION = "v1.0"; // sincronizado con backend

export const usePolicyAcceptance = (token: string | null = localStorage.getItem("token")) => {
  const [loading, setLoading] = useState(true);
  const [needsAcceptance, setNeedsAcceptance] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const checkPolicy = async () => {
      try {
        const res = await axios.get("/api/policies", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const hasAccepted = res.data.data?.some(
          (p: any) =>
            p.policyType === "privacy_policy" &&
            p.policyVersion === POLICY_VERSION
        );

        setNeedsAcceptance(!hasAccepted);
      } catch (err) {
        console.error("Error checking policies:", err);
      } finally {
        setLoading(false);
      }
    };

    checkPolicy();
  }, [token]);

  const acceptPolicy = async () => {
    if (!token) return;

    try {
      await axios.post(
        "/api/policies/accept",
        {
          policyType: "privacy_policy",
          policyVersion: POLICY_VERSION,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setNeedsAcceptance(false);
    } catch (err) {
      console.error("Error accepting policy:", err);
    }
  };

  const hasAccepted = !needsAcceptance;

  return { loading, needsAcceptance, hasAccepted, acceptPolicy };
};
