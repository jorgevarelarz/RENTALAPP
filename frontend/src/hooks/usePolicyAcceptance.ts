// src/hooks/usePolicyAcceptance.ts
import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const REQUIRED_TYPES = [
  "privacy_policy",
  "terms_of_service",
  "data_processing",
] as const;
type PolicyType = (typeof REQUIRED_TYPES)[number];

const storageKey = (type: string) => `policy_version_${type}`;

export const usePolicyAcceptance = (
  token: string | null = localStorage.getItem("token"),
  requiredTypes: PolicyType[] = REQUIRED_TYPES
) => {
  const [loading, setLoading] = useState(true);
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [pending, setPending] = useState<
    { policyType: PolicyType; version: string }[]
  >([]);
  const [activeVersions, setActiveVersions] = useState<
    Record<PolicyType, string | null>
  >({
    privacy_policy: null,
    terms_of_service: null,
    data_processing: null,
  });

  const acceptedVersions = useMemo(() => {
    const map: Record<string, string | null> = {};
    requiredTypes.forEach((t) => {
      map[t] = localStorage.getItem(storageKey(t));
    });
    return map;
  }, [requiredTypes]);
  const acceptedDeps = useMemo(() => JSON.stringify(acceptedVersions), [acceptedVersions]);
  const requiredKey = useMemo(() => requiredTypes.join('|'), [requiredTypes]);

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

        const activeList: any[] = res.data?.data || [];
        const nextActive: Record<PolicyType, string | null> = {
          privacy_policy: null,
          terms_of_service: null,
          data_processing: null,
        };
        const nextPending: { policyType: PolicyType; version: string }[] = [];

        requiredTypes.forEach((type) => {
          const active = activeList.find((p) => p.policyType === type);
          const version = active?.version ?? null;
          nextActive[type] = version;
          const accepted = acceptedVersions[type];
          if (version && version !== accepted) {
            nextPending.push({ policyType: type, version });
          }
        });

        setActiveVersions(nextActive);
        setPending(nextPending);
        setNeedsAcceptance(nextPending.length > 0);
      } catch (err) {
        console.error("Error checking policies:", err);
      } finally {
        setLoading(false);
      }
    };

    checkPolicy();
  }, [token, acceptedDeps, requiredKey, acceptedVersions, requiredTypes]);

  const acceptPolicy = async () => {
    if (!token || pending.length === 0) return;
    const current = pending[0];

    try {
      await axios.post(
        "/api/policies/accept",
        {
          policyType: current.policyType,
          policyVersion: current.version,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      localStorage.setItem(storageKey(current.policyType), current.version);
      const nextPending = pending.slice(1);
      setPending(nextPending);
      setNeedsAcceptance(nextPending.length > 0);
    } catch (err) {
      console.error("Error accepting policy:", err);
    }
  };

  const hasAccepted = !needsAcceptance;
  const pendingPolicy = pending[0] || null;

  return {
    loading,
    needsAcceptance,
    hasAccepted,
    activeVersion: pendingPolicy?.version ?? null,
    pendingPolicy,
    acceptPolicy,
  };
};
