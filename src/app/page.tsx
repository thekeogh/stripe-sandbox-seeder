"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import BusinessRounded from "@mui/icons-material/BusinessRounded";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import DataObjectRounded from "@mui/icons-material/DataObjectRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import { BatchProgress, type SeedResult } from "@/components/batch-progress";
import { MetadataEditor } from "@/components/metadata-editor";
import { formatMajorAmount, majorAmountToMinor } from "@/lib/money";
import {
  configSchema,
  countries,
  type Address,
  type Catalog,
  type Country,
  type MetadataRow,
  type SeedConfig,
} from "@/lib/schema";

type Preview = {
  name: string;
  email: string;
  address: Address & { country: string };
};
type Result = SeedResult;
type Run = {
  id: string;
  total: number;
  completed: number;
  config: SeedConfig;
  results: Result[];
  createdAt: number;
  keyFingerprint: string;
};
const emptyRows = () => [{ key: "", value: "" }];
const emptyAddress: Address = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
};
const addressLabels: Record<keyof Address, string> = {
  line1: "Address line 1",
  line2: "Address line 2",
  city: "City",
  state: "County / State",
  postal_code: "Postcode / ZIP",
};
const STORAGE_KEY = "stripe-seeder-pending-run";
const SETTINGS_KEY = "stripe-seeder-settings-v1";
const pageWidth = {
  width: { xs: "100%", md: "90%" },
  px: { xs: 2, sm: 3, md: 0 },
};
function Section({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, mb: 2.5 }}>
      <Stack direction="row" sx={{ gap: 2, alignItems: "center", mb: 3 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            display: "grid",
            placeItems: "center",
            bgcolor: "#282536",
            color: "primary.main",
            borderRadius: 2,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {step}
        </Box>
        <Box>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
      </Stack>
      {children}
    </Paper>
  );
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [testClockId, setTestClockId] = useState("");
  const [rememberKey, setRememberKey] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [connectedKey, setConnectedKey] = useState<string | null>(null);
  const initialSettings = useRef<Record<string, unknown>>({});
  const initialPreviewHandled = useRef(false);
  const [count, setCount] = useState("10");
  const [nameType, setNameType] = useState<"company" | "person">("company");
  const [domain, setDomain] = useState("");
  const [country, setCountry] = useState<Country>("GB");
  const [overrides, setOverrides] = useState<Partial<Address>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTick, setPreviewTick] = useState(0);
  const [customerMetadata, setCustomerMetadata] =
    useState<MetadataRow[]>(emptyRows);
  const [subscriptionMetadata, setSubscriptionMetadata] =
    useState<MetadataRow[]>(emptyRows);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [productId, setProductId] = useState("");
  const [priceId, setPriceId] = useState("");
  const [customCurrency, setCustomCurrency] = useState<
    "usd" | "gbp" | "eur" | "cad"
  >("gbp");
  const [customInterval, setCustomInterval] = useState<
    "day" | "week" | "month" | "year"
  >("year");
  const [customAmount, setCustomAmount] = useState("");
  const [couponId, setCouponId] = useState("");
  const [offline, setOffline] = useState(false);
  const [quantityMode, setQuantityMode] = useState<"random" | "fixed">(
    "random",
  );
  const [quantity, setQuantity] = useState("1");
  const [netD, setNetD] = useState("30");
  const [trialDays, setTrialDays] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const stopRequested = useRef(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [keepApiKey, setKeepApiKey] = useState(true);
  const [resetError, setResetError] = useState("");
  const pending = !!run && run.completed < run.total;

  function resetEverything() {
    if (runningRef.current || catalogLoading) return;
    const nextRememberKey = keepApiKey ? rememberKey : true;
    const nextApiKey = keepApiKey ? apiKey : "";
    try {
      // Clear only this app's settings, never unrelated browser storage.
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          apiKey: nextRememberKey ? nextApiKey : "",
          rememberKey: nextRememberKey,
        }),
      );
    } catch {
      setResetError(
        "Could not clear saved settings. Check browser storage access and try again.",
      );
      return;
    }
    initialSettings.current = {};
    setApiKey(nextApiKey);
    setTestClockId("");
    setRememberKey(nextRememberKey);
    if (!keepApiKey) {
      setConnectedKey(null);
      setCatalog(null);
    }
    setCount("10");
    setNameType("company");
    setDomain("");
    setCountry("GB");
    setOverrides({});
    setCustomerMetadata(emptyRows());
    setSubscriptionMetadata(emptyRows());
    setProductId("");
    setPriceId("");
    setCustomCurrency("gbp");
    setCustomInterval("year");
    setCustomAmount("");
    setCouponId("");
    setOffline(false);
    setNetD("30");
    setTrialDays("");
    setQuantityMode("random");
    setQuantity("1");
    setRun(null);
    setRetryable(false);
    setError("");
    setCatalogError("");
    setStorageWarning("");
    setPreview(null);
    setPreviewError("");
    setPreviewTick((t) => t + 1);
    stopRequested.current = false;
    setStopping(false);
    setResetOpen(false);
  }

  const loadCatalog = useCallback(
    async (
      key: string,
      selections?: { productId?: string; priceId?: string; couponId?: string },
    ) => {
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const response = await fetch("/api/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: key }),
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setCatalog(data);
        setConnectedKey(key);
        const chosenProduct = data.products.some(
          (p: { id: string }) => p.id === selections?.productId,
        )
          ? selections!.productId!
          : "";
        const chosenPrice = data.prices.some(
          (p: { id: string; productId: string }) =>
            p.id === selections?.priceId && p.productId === chosenProduct,
        )
          ? selections!.priceId!
          : chosenProduct &&
              (selections?.priceId === "custom" ||
                !data.prices.some(
                  (p: { productId: string }) => p.productId === chosenProduct,
                ))
            ? "custom"
            : "";
        setProductId(chosenProduct);
        setPriceId(chosenPrice);
        setCouponId(
          data.coupons.some(
            (c: { id: string }) => c.id === selections?.couponId,
          )
            ? selections!.couponId!
            : "",
        );
      } catch (e) {
        setCatalog(null);
        setConnectedKey(null);
        setCatalogError(
          e instanceof Error ? e.message : "Could not connect to Stripe.",
        );
      } finally {
        setCatalogLoading(false);
      }
    },
    [],
  );
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      initialSettings.current = saved;
      if (typeof saved.count === "string") setCount(saved.count);
      if (saved.nameType === "person" || saved.nameType === "company")
        setNameType(saved.nameType);
      if (typeof saved.domain === "string") setDomain(saved.domain);
      if (saved.country in countries) setCountry(saved.country);
      if (saved.overrides && typeof saved.overrides === "object")
        setOverrides(saved.overrides);
      if (Array.isArray(saved.customerMetadata))
        setCustomerMetadata(saved.customerMetadata);
      if (Array.isArray(saved.subscriptionMetadata))
        setSubscriptionMetadata(saved.subscriptionMetadata);
      if (typeof saved.offline === "boolean") setOffline(saved.offline);
      if (saved.quantityMode === "random" || saved.quantityMode === "fixed")
        setQuantityMode(saved.quantityMode);
      if (typeof saved.quantity === "string") setQuantity(saved.quantity);
      if (typeof saved.netD === "string") setNetD(saved.netD);
      if (["usd", "gbp", "eur", "cad"].includes(saved.customCurrency))
        setCustomCurrency(saved.customCurrency);
      if (["day", "week", "month", "year"].includes(saved.customInterval))
        setCustomInterval(saved.customInterval);
      if (typeof saved.customAmount === "string")
        setCustomAmount(saved.customAmount);
      if (typeof saved.trialDays === "string") setTrialDays(saved.trialDays);
      if (typeof saved.rememberKey === "boolean")
        setRememberKey(saved.rememberKey);
      if (typeof saved.apiKey === "string") setApiKey(saved.apiKey);
      if (typeof saved.testClockId === "string")
        setTestClockId(saved.testClockId);
      if (saved.preview) setPreview(saved.preview);
      // Restore selections when the connected catalogue has verified them.
      if (saved.apiKey) void loadCatalog(saved.apiKey, saved);
    } catch {
      setStorageWarning("Saved settings could not be read. Using defaults.");
    }
    setHydrated(true);
  }, [loadCatalog]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (catalog)
        initialSettings.current = {
          ...initialSettings.current,
          productId,
          priceId,
          customCurrency,
          customInterval,
          customAmount,
          couponId,
        };
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          count,
          nameType,
          domain,
          country,
          overrides,
          customerMetadata,
          subscriptionMetadata,
          offline,
          netD,
          trialDays,
          quantityMode,
          quantity,
          customCurrency,
          customInterval,
          customAmount,
          rememberKey,
          apiKey: rememberKey ? apiKey : "",
          testClockId,
          productId: catalog
            ? productId
            : initialSettings.current.productId || "",
          priceId: catalog ? priceId : initialSettings.current.priceId || "",
          couponId: catalog ? couponId : initialSettings.current.couponId || "",
          preview,
        }),
      );
    } catch {
      setStorageWarning(
        "Your browser could not save settings. Changes will last only for this visit.",
      );
    }
  }, [
    hydrated,
    count,
    nameType,
    domain,
    country,
    overrides,
    customerMetadata,
    subscriptionMetadata,
    offline,
    netD,
    trialDays,
    quantity,
    quantityMode,
    rememberKey,
    apiKey,
    testClockId,
    productId,
    priceId,
    customCurrency,
    customInterval,
    customAmount,
    couponId,
    catalog,
    preview,
  ]);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const restored = JSON.parse(stored) as Run;
        if (
          restored.completed < restored.total &&
          Date.now() - restored.createdAt < 23 * 60 * 60 * 1000 &&
          configSchema.safeParse(restored.config).success
        ) {
          setRun(restored);
          setRetryable(true);
          setError(
            "An unfinished batch was restored. Resume to retry the next customer with the same request ID.",
          );
        } else sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      setStorageWarning(
        "Browser session storage is unavailable. Keep this page open during seeding.",
      );
    }
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    if (!initialPreviewHandled.current) {
      initialPreviewHandled.current = true;
      if (initialSettings.current.preview) return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const response = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nameType,
            domain,
            country,
            addressOverrides: {},
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error("Enter a valid email domain to generate a preview.");
        setPreview(data);
        setPreviewError("");
      } catch (e) {
        if (!controller.signal.aborted)
          setPreviewError(
            e instanceof Error ? e.message : "Preview unavailable.",
          );
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [hydrated, nameType, domain, country, previewTick]);
  useEffect(() => {
    if (!pending && !running) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending, running]);

  function persist(next: Run, failedDefinitively = false) {
    try {
      if (next.completed === next.total || failedDefinitively)
        sessionStorage.removeItem(STORAGE_KEY);
      else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setStorageWarning(
        "Could not save batch progress. Keep this page open until the batch finishes.",
      );
    }
  }
  async function fingerprint(key: string) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(key),
    );
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  async function execute(initial: Run) {
    if (runningRef.current) return;
    if (
      connectedKey === null ||
      (await fingerprint(connectedKey)) !== initial.keyFingerprint
    ) {
      setError(
        "Connect using the same sandbox API key before resuming this batch.",
      );
      return;
    }
    if (Date.now() - initial.createdAt >= 23 * 60 * 60 * 1000) {
      setError(
        "This batch is too old to retry safely. Review its customers in Stripe and start a new batch.",
      );
      setRetryable(false);
      return;
    }
    runningRef.current = true;
    setRunning(true);
    setError("");
    setRetryable(false);
    stopRequested.current = false;
    setStopping(false);
    let next = initial;
    setRun(next);
    persist(next);
    try {
      for (let index = next.completed; index < next.total; index++) {
        const response = await fetch("/api/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId: next.id,
            index,
            config: next.config,
            apiKey: connectedKey,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setRetryable(!!data.retryable);
          setError(data.error);
          if (!data.retryable) persist(next, true);
          return;
        }
        next = {
          ...next,
          completed: index + 1,
          results: [data as Result, ...next.results].slice(0, 100),
        };
        setRun(next);
        persist(next);
        if (stopRequested.current) {
          setRetryable(true);
          return;
        }
      }
    } catch {
      setError(
        "The connection was interrupted. Resume this batch to retry the same customer safely.",
      );
      setRetryable(true);
    } finally {
      runningRef.current = false;
      setRunning(false);
      setStopping(false);
    }
  }
  async function start() {
    setError("");
    if (connectedKey === null) {
      setError("Connect your sandbox first.");
      return;
    }
    const total = Number(count);
    if (!/^\d+$/.test(count) || !Number.isSafeInteger(total) || total <= 0) {
      setError("Enter a whole number of customers greater than zero.");
      return;
    }
    if (
      offline &&
      (!/^\d+$/.test(netD) || !Number.isSafeInteger(Number(netD)))
    ) {
      setError("Net D must be a whole number of days, zero or greater.");
      return;
    }
    if (
      quantityMode === "fixed" &&
      selectedPrice?.usageType !== "metered" &&
      (!/^\d+$/.test(quantity) ||
        !Number.isSafeInteger(Number(quantity)) ||
        Number(quantity) < 1)
    ) {
      setError("Enter a whole-number quantity greater than zero.");
      return;
    }
    const customUnitAmount =
      priceId === "custom" ? majorAmountToMinor(customAmount) : null;
    if (priceId === "custom" && customUnitAmount === null) {
      setError(
        "Enter a valid custom unit amount greater than zero, with up to two decimal places.",
      );
      return;
    }
    if (
      trialDays !== "" &&
      (!/^\d+$/.test(trialDays) ||
        !Number.isSafeInteger(Number(trialDays)) ||
        Number(trialDays) < 1)
    ) {
      setError(
        "Free trial must be a whole number of days greater than zero, or left blank.",
      );
      return;
    }
    const parsed = configSchema.safeParse({
      testClockId,
      nameType,
      domain,
      country,
      addressOverrides: overrides,
      customerMetadata,
      subscriptionMetadata,
      priceId: priceId === "custom" ? "" : priceId,
      ...(priceId === "custom"
        ? {
            priceData: {
              currency: customCurrency,
              product: productId,
              recurring: { interval: customInterval },
              unit_amount: customUnitAmount!,
            },
          }
        : {}),
      metadataReferenceDate: new Date().toISOString(),
      quantityMode,
      quantity:
        quantityMode === "random" || selectedPrice?.usageType === "metered"
          ? 1
          : Number(quantity),
      couponId,
      offline,
      ...(offline ? { daysUntilDue: Number(netD) } : {}),
      ...(trialDays !== "" ? { trialDays: Number(trialDays) } : {}),
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    void execute({
      id: crypto.randomUUID(),
      total,
      completed: 0,
      config: parsed.data,
      results: [],
      createdAt: Date.now(),
      keyFingerprint: await fingerprint(connectedKey),
    });
  }
  const prices = catalog?.prices.filter((p) => p.productId === productId) || [];
  const selectedPrice = catalog?.prices.find((p) => p.id === priceId);
  const isCustomPrice = priceId === "custom";
  const selectedProduct = catalog?.products.find((p) => p.id === productId);
  const coupons =
    catalog?.coupons.filter(
      (c) =>
        (!c.products.length || c.products.includes(productId)) &&
        (!c.currency ||
          c.currency ===
            (isCustomPrice ? customCurrency : selectedPrice?.currency)),
    ) || [];
  const address = { ...(preview?.address || emptyAddress), ...overrides };

  return (
    <Box sx={{ pb: run ? "calc(80px + env(safe-area-inset-bottom))" : 0 }}>
      <Box
        component="header"
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "#17181d",
        }}
      >
        <Container maxWidth={false} sx={pageWidth}>
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              py: 2.25,
            }}
          >
            <Stack direction="row" sx={{ gap: 1.5, alignItems: "center" }}>
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 36,
                  height: 36,
                  bgcolor: "#aaa0ff",
                  borderRadius: 2,
                  color: "#211b43",
                }}
              >
                <DataObjectRounded />
              </Box>
              <Typography sx={{ fontWeight: 650, fontSize: 15 }}>
                stripe
                <span style={{ color: "#9292a5", fontWeight: 400 }}>
                  {" "}
                  / sandbox seeder
                </span>
              </Typography>
            </Stack>
            <Chip
              size="small"
              icon={<ShieldOutlined sx={{ fontSize: "16px !important" }} />}
              label="Sandbox only"
              sx={{
                bgcolor: "#222b27",
                color: "#8edcba",
                "& .MuiChip-icon": { color: "#8edcba" },
              }}
            />
          </Stack>
        </Container>
      </Box>
      <Container
        component="main"
        maxWidth={false}
        sx={{ ...pageWidth, pt: { xs: 4, md: 5.5 }, pb: 6 }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{
            alignItems: { sm: "center" },
            justifyContent: "space-between",
            gap: 2,
            mb: 4,
          }}
        >
          <Box>
            <Typography
              variant="overline"
              color="primary.main"
              sx={{ letterSpacing: 2 }}
            >
              YOUR TEST DATA, SORTED
            </Typography>
            <Typography component="h1" variant="h4" sx={{ mt: 0.5, mb: 1 }}>
              A fresh start for your sandbox.
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Realistic customers. Ready-to-test subscriptions. One simple
              batch.
            </Typography>
          </Box>
          <Stack
            sx={{
              gap: 1.5,
              alignItems: { xs: "flex-start", sm: "flex-end" },
              flexShrink: 0,
            }}
          >
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshRounded />}
              disabled={!hydrated || running || catalogLoading}
              onClick={() => {
                setKeepApiKey(true);
                setResetError("");
                setResetOpen(true);
              }}
            >
              Reset Everything
            </Button>
            <Chip
              variant="outlined"
              size="small"
              label={
                catalogLoading
                  ? "Connecting…"
                  : catalog
                    ? "●  Stripe connected"
                    : "○  Not connected"
              }
              color={catalog ? "success" : "default"}
            />
          </Stack>
        </Stack>
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            sx={{ gap: 3, alignItems: { sm: "center" } }}
          >
            <Box sx={{ minWidth: 170 }}>
              <Typography variant="h6">Stripe connection</Typography>
              <Typography variant="body2" color="text.secondary">
                Your sandbox API key
              </Typography>
            </Box>
            <TextField
              label="Secret API key"
              type="password"
              placeholder="sk_test_…"
              value={apiKey}
              disabled={running || catalogLoading}
              autoComplete="off"
              onChange={(e) => {
                setApiKey(e.target.value.trim());
                setCatalog(null);
                setConnectedKey(null);
              }}
              helperText="Sent only to this app’s server and Stripe. Live keys are rejected."
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button
              variant="outlined"
              disabled={running || catalogLoading}
              sx={{ minWidth: 120, alignSelf: { sm: "flex-start" } }}
              onClick={() =>
                loadCatalog(apiKey, {
                  productId:
                    productId || (initialSettings.current.productId as string),
                  priceId:
                    priceId || (initialSettings.current.priceId as string),
                  couponId:
                    couponId || (initialSettings.current.couponId as string),
                })
              }
            >
              {catalogLoading
                ? "Connecting…"
                : catalog
                  ? "Reconnect"
                  : "Connect"}
            </Button>
          </Stack>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={rememberKey}
                onChange={(e) => setRememberKey(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                Remember API key on this browser · stored locally with your form
                settings
              </Typography>
            }
          />
          <Divider sx={{ my: 2 }} />
          <TextField
            label="Test Clock ID"
            placeholder="clock_…"
            value={testClockId}
            onChange={(e) => setTestClockId(e.target.value)}
            disabled={running || pending}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Optional. Customers and their subscriptions will use this clock. Leave blank to seed without a test clock."
          />
        </Paper>
        {catalogError && (
          <Alert
            severity="info"
            sx={{ mb: 3 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() =>
                  loadCatalog(apiKey, { productId, priceId, couponId })
                }
              >
                Reconnect
              </Button>
            }
          >
            <strong>Connect your sandbox</strong>
            <br />
            {catalogError} You can explore the form and preview data before
            connecting.
          </Alert>
        )}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 320px" },
            gap: 3,
            alignItems: "start",
          }}
        >
          <Box component="fieldset" disabled={running || pending}>
            <Section
              step="01"
              title="Customer profile"
              subtitle="Choose the shape of your test customers."
            >
              <Stack sx={{ gap: 3 }}>
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, mb: 1.25 }}
                  >
                    Generate names as
                  </Typography>
                  <ToggleButtonGroup
                    value={nameType}
                    exclusive
                    fullWidth
                    onChange={(_, value) => value && setNameType(value)}
                    sx={{
                      "& .MuiToggleButton-root": {
                        py: 1.3,
                        textTransform: "none",
                      },
                      "& .Mui-selected": {
                        bgcolor: "#302b46 !important",
                        color: "#c4bcff !important",
                        borderColor: "#6a6098 !important",
                      },
                    }}
                  >
                    <ToggleButton value="company">
                      <BusinessRounded sx={{ mr: 1, fontSize: 19 }} />
                      Company
                    </ToggleButton>
                    <ToggleButton value="person">
                      <PersonOutlineRounded sx={{ mr: 1, fontSize: 19 }} />
                      First & last name
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <TextField
                  label="Email domain"
                  placeholder="Automatic — based on each customer"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  helperText={
                    domain
                      ? "This domain will be used for every customer. A leading @ is optional."
                      : nameType === "company"
                        ? "A random username @ a domain based on the generated company."
                        : "First and last name @ a randomly generated domain."
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Divider />
                <MetadataEditor
                  label="Customer"
                  disabled={running || pending}
                  rows={customerMetadata}
                  onChange={setCustomerMetadata}
                />
                {offline && (
                  <Alert severity="info" icon={false} sx={{ py: 0.25 }}>
                    Automatically adds <code>isInvoiced: "true"</code> to each
                    customer, overriding that key if entered above.
                  </Alert>
                )}
                <Divider />
                <Stack
                  direction="row"
                  sx={{ alignItems: "center", justifyContent: "space-between" }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Billing address
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<RefreshRounded />}
                    onClick={() => {
                      setOverrides({});
                      setPreviewTick((t) => t + 1);
                    }}
                  >
                    Regenerate
                  </Button>
                </Stack>
                <TextField
                  select
                  label="Country"
                  disabled={running || pending}
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value as Country);
                    setOverrides({});
                  }}
                >
                  {Object.entries(countries).map(([code, name]) => (
                    <MenuItem value={code} key={code}>
                      {name}
                    </MenuItem>
                  ))}
                </TextField>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 2.5,
                  }}
                >
                  {(Object.keys(addressLabels) as (keyof Address)[]).map(
                    (key) => (
                      <TextField
                        key={key}
                        label={addressLabels[key]}
                        value={address[key]}
                        onChange={(e) =>
                          setOverrides((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        slotProps={{ inputLabel: { shrink: true } }}
                        sx={{
                          gridColumn:
                            key === "line1" || key === "line2"
                              ? "1 / -1"
                              : undefined,
                        }}
                        helperText={
                          Object.hasOwn(overrides, key)
                            ? "Your override · applied to every customer"
                            : undefined
                        }
                      />
                    ),
                  )}
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: -1 }}
                >
                  Showing a sample. Each customer gets a fresh address in this
                  country. Edited fields are reused across the batch.
                </Typography>
              </Stack>
            </Section>
            <Section
              step="02"
              title="Subscription"
              subtitle="Every customer gets one subscription."
            >
              <Stack sx={{ gap: 3 }}>
                <Stack direction="row" sx={{ gap: 1, alignItems: "start" }}>
                  <TextField
                    select
                    label="Product"
                    value={catalog ? productId : ""}
                    disabled={!catalog || running || pending}
                    onChange={(e) => {
                      setProductId(e.target.value);
                      setCouponId("");
                      const matching = catalog?.prices.filter(
                        (p) => p.productId === e.target.value,
                      );
                      setPriceId(
                        matching?.length === 1
                          ? matching[0].id
                          : matching?.length === 0
                            ? "custom"
                            : "",
                      );
                    }}
                    helperText={
                      catalog && !catalog.products.length
                        ? "No active products found in this sandbox."
                        : "Loaded from your Stripe product catalogue."
                    }
                    slotProps={{
                      inputLabel: { shrink: true },
                      select: { displayEmpty: true },
                    }}
                  >
                    <MenuItem value="" disabled>
                      {catalogLoading
                        ? "Loading products…"
                        : "Select a product"}
                    </MenuItem>
                    {catalog?.products.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Tooltip title="Refresh products, prices and coupons">
                    <span>
                      <IconButton
                        aria-label="Refresh Stripe catalogue"
                        disabled={catalogLoading || running || pending}
                        onClick={() =>
                          loadCatalog(apiKey, { productId, priceId, couponId })
                        }
                      >
                        <RefreshRounded />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                <TextField
                  select
                  label="Recurring price"
                  value={catalog ? priceId : ""}
                  disabled={!productId || !catalog || running || pending}
                  onChange={(e) => {
                    setPriceId(e.target.value);
                    setCouponId("");
                  }}
                  helperText={
                    productId && !prices.length
                      ? "This product has no active recurring prices. Enter a custom price below."
                      : "Choose a saved price or enter a custom price below."
                  }
                  slotProps={{
                    inputLabel: { shrink: true },
                    select: { displayEmpty: true },
                  }}
                >
                  <MenuItem value="" disabled>
                    Select a recurring price
                  </MenuItem>
                  {prices.map((p) => (
                    <MenuItem
                      key={p.id}
                      value={p.id}
                      sx={{ whiteSpace: "normal" }}
                    >
                      {p.label}
                    </MenuItem>
                  ))}
                  <MenuItem value="custom">Custom price</MenuItem>
                </TextField>
                {isCustomPrice && (
                  <Stack sx={{ gap: 2 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      sx={{ gap: 2 }}
                    >
                      <TextField
                        select
                        label="Currency"
                        value={customCurrency}
                        onChange={(e) => {
                          setCustomCurrency(
                            e.target.value as typeof customCurrency,
                          );
                          setCouponId("");
                        }}
                        disabled={running || pending}
                        sx={{ flex: 1 }}
                      >
                        <MenuItem value="usd">USD · $</MenuItem>
                        <MenuItem value="gbp">GBP · £</MenuItem>
                        <MenuItem value="eur">EUR · €</MenuItem>
                        <MenuItem value="cad">CAD · CA$</MenuItem>
                      </TextField>
                      <TextField
                        select
                        label="Billing interval"
                        value={customInterval}
                        onChange={(e) =>
                          setCustomInterval(
                            e.target.value as typeof customInterval,
                          )
                        }
                        disabled={running || pending}
                        sx={{ flex: 1 }}
                      >
                        <MenuItem value="year">Year</MenuItem>
                        <MenuItem value="month">Month</MenuItem>
                        <MenuItem value="week">Week</MenuItem>
                        <MenuItem value="day">Day</MenuItem>
                      </TextField>
                    </Stack>
                    <TextField
                      label="Unit amount"
                      value={customAmount}
                      onChange={(e) => {
                        const formatted = formatMajorAmount(e.target.value);
                        if (formatted !== null) setCustomAmount(formatted);
                      }}
                      disabled={running || pending}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <Box
                              component="span"
                              sx={{ mr: 1, color: "text.secondary" }}
                            >
                              {
                                { usd: "$", gbp: "£", eur: "€", cad: "CA$" }[
                                  customCurrency
                                ]
                              }
                            </Box>
                          ),
                        },
                        htmlInput: { inputMode: "decimal" },
                      }}
                      helperText="Enter the price per unit in major currency units. For example, 1,000.50 becomes 100,050 in Stripe."
                    />
                  </Stack>
                )}
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, mb: 1.25 }}
                  >
                    Quantity per subscription
                  </Typography>
                  {selectedPrice?.usageType === "metered" ? (
                    <Typography variant="body2" color="text.secondary">
                      Metered price: quantity comes from reported usage.
                    </Typography>
                  ) : (
                    <Stack sx={{ gap: 2 }}>
                      <ToggleButtonGroup
                        value={quantityMode}
                        exclusive
                        fullWidth
                        disabled={running || pending}
                        aria-label="Quantity mode"
                        onChange={(_, value) => value && setQuantityMode(value)}
                      >
                        <ToggleButton
                          value="random"
                          sx={{ textTransform: "none" }}
                        >
                          Random · 1–999
                        </ToggleButton>
                        <ToggleButton
                          value="fixed"
                          sx={{ textTransform: "none" }}
                        >
                          Fixed quantity
                        </ToggleButton>
                      </ToggleButtonGroup>
                      {quantityMode === "random" ? (
                        <Typography variant="body2" color="text.secondary">
                          Each subscription gets its own random quantity between
                          1 and 999.
                        </Typography>
                      ) : (
                        <TextField
                          label="Quantity"
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          disabled={running || pending}
                          slotProps={{ htmlInput: { min: 1, step: 1 } }}
                          helperText="Seats or licences per subscription. The same quantity for every customer."
                        />
                      )}
                    </Stack>
                  )}
                </Box>
                <TextField
                  select
                  label="Coupon"
                  value={catalog ? couponId : ""}
                  disabled={!priceId || !catalog || running || pending}
                  onChange={(e) => setCouponId(e.target.value)}
                  helperText="Valid coupons compatible with this product and currency."
                >
                  <MenuItem value="">None</MenuItem>
                  {coupons.map((c) => (
                    <MenuItem value={c.id} key={c.id}>
                      {c.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Free trial (days)"
                  type="number"
                  value={trialDays}
                  onChange={(e) => setTrialDays(e.target.value)}
                  disabled={running || pending}
                  slotProps={{ htmlInput: { min: 1, step: 1 } }}
                  helperText="Leave blank for no trial, or enter days (e.g. 30). Applies to every subscription in the batch."
                />
                <Divider />
                <MetadataEditor
                  label="Subscription"
                  disabled={running || pending}
                  rows={subscriptionMetadata}
                  onChange={setSubscriptionMetadata}
                />
                <Divider />
                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={offline}
                        onChange={(e) => setOffline(e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Offline/Invoice payment method
                      </Typography>
                    }
                  />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 4 }}
                  >
                    {offline
                      ? "Create invoices with your agreed payment terms."
                      : "A successful Visa test card is attached automatically."}
                  </Typography>
                </Box>
                <Collapse
                  in={offline}
                  sx={{ "& .MuiCollapse-wrapperInner": { pt: 1 } }}
                >
                  <Stack sx={{ gap: 2 }}>
                    <TextField
                      label="Payment due in (Net D)"
                      type="number"
                      value={netD}
                      onChange={(e) => setNetD(e.target.value)}
                      slotProps={{ htmlInput: { min: 0, max: 730, step: 1 } }}
                      helperText="Days until payment is due. Use 0 for due immediately."
                    />
                    <Alert severity="info" icon={false}>
                      <Typography variant="body2">
                        Uses invoice collection, card-only payment settings, and
                        customer metadata <code>isInvoiced: "true"</code>.
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ display: "block", mt: 1 }}
                      >
                        Runbook follow-up: check “Include a link to a payment
                        page” is off in Stripe. This Dashboard setting is not
                        applied by the seeder.
                      </Typography>
                    </Alert>
                  </Stack>
                </Collapse>
              </Stack>
            </Section>
          </Box>
          <Stack sx={{ gap: 2.5, ...{ position: { md: "sticky" }, top: 24 } }}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderColor: "#4b426c",
                background: "linear-gradient(145deg, #252231, #1a1b21 70%)",
              }}
            >
              <Stack
                direction="row"
                sx={{ gap: 1, alignItems: "center", mb: 1 }}
              >
                <AutoAwesomeRounded color="primary" sx={{ fontSize: 20 }} />
                <Typography variant="h6">Seed your sandbox</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                One customer. One subscription.
                <br />
                Repeated as many times as you need.
              </Typography>
              <TextField
                label="Number of customers"
                type="number"
                value={count}
                disabled={running || pending}
                onChange={(e) => setCount(e.target.value)}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                helperText="Any whole number greater than zero."
              />
              <Stack sx={{ gap: 1.5, py: 3 }}>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", gap: 2 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Product
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: "right" }}>
                    {selectedProduct?.name || "Not selected"}
                  </Typography>
                </Stack>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography variant="body2" color="text.secondary">
                    Payment
                  </Typography>
                  <Typography variant="body2">
                    {offline ? `Invoice · Net ${netD || "—"}` : "Test card"}
                  </Typography>
                </Stack>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography variant="body2" color="text.secondary">
                    Country
                  </Typography>
                  <Typography variant="body2">{countries[country]}</Typography>
                </Stack>
              </Stack>
              {run && (
                <Box aria-live="polite" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {run.completed} of {run.total} customer/subscription pairs
                    created
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(run.completed / run.total) * 100}
                  />
                </Box>
              )}
              <Box aria-live="polite">
                {error && (
                  <Alert
                    severity="error"
                    sx={{ mb: 2, overflowWrap: "anywhere" }}
                  >
                    {error}
                  </Alert>
                )}
                {storageWarning && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {storageWarning}
                  </Alert>
                )}
              </Box>
              {running ? (
                <Button
                  fullWidth
                  variant="outlined"
                  disabled={stopping}
                  onClick={() => {
                    stopRequested.current = true;
                    setStopping(true);
                  }}
                >
                  {stopping
                    ? "Pausing after this customer…"
                    : "Pause after this customer"}
                </Button>
              ) : pending ? (
                <Stack sx={{ gap: 1 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    disabled={!retryable || connectedKey === null}
                    onClick={() => run && execute(run)}
                  >
                    Resume batch
                  </Button>
                  <Button
                    fullWidth
                    color="inherit"
                    onClick={() => {
                      sessionStorage.removeItem(STORAGE_KEY);
                      setRun(null);
                      setError("");
                      setRetryable(false);
                    }}
                  >
                    Finish this batch
                  </Button>
                </Stack>
              ) : (
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardRounded />}
                  disabled={!priceId || !catalog || catalogLoading}
                  onClick={start}
                >
                  Seed customers
                </Button>
              )}
              <Stack
                direction="row"
                sx={{
                  gap: 0.75,
                  alignItems: "center",
                  justifyContent: "center",
                  mt: 2,
                }}
              >
                <ShieldOutlined
                  sx={{ color: "text.secondary", fontSize: 14 }}
                />
                <Typography variant="caption" color="text.secondary">
                  Test data only. Live keys are blocked.
                </Typography>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 2,
                }}
              >
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ letterSpacing: 1.5 }}
                >
                  A LITTLE PREVIEW
                </Typography>
                <IconButton
                  aria-label="Generate another preview"
                  size="small"
                  disabled={previewLoading}
                  onClick={() => setPreviewTick((t) => t + 1)}
                >
                  {previewLoading ? (
                    <CircularProgress size={16} />
                  ) : (
                    <RefreshRounded sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </Stack>
              {previewError ? (
                <Typography color="error" variant="body2">
                  {previewError}
                </Typography>
              ) : preview ? (
                <>
                  <Box
                    sx={{
                      display: "grid",
                      placeItems: "center",
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      bgcolor: "#302b46",
                      mb: 2,
                    }}
                  >
                    {nameType === "company" ? (
                      <BusinessRounded color="primary" />
                    ) : (
                      <PersonOutlineRounded color="primary" />
                    )}
                  </Box>
                  <Typography
                    sx={{ fontWeight: 600, ...{ overflowWrap: "anywhere" } }}
                  >
                    {preview.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {preview.email}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 2 }}
                  >
                    {address.line1}
                    <br />
                    {address.line2 && (
                      <>
                        {address.line2}
                        <br />
                      </>
                    )}
                    {address.city}, {address.postal_code}
                    <br />
                    {countries[country]}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}>
                    <ReceiptLongRounded
                      sx={{ fontSize: 17, color: "primary.main" }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {selectedProduct?.name || "Your selected product"} ·{" "}
                      {offline ? "Invoice" : "Test card"}
                    </Typography>
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Generating a realistic customer…
                </Typography>
              )}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 2 }}
              >
                Sample only · powered by Faker
              </Typography>
            </Paper>
          </Stack>
        </Box>

        <Stack
          direction="row"
          sx={{
            justifyContent: "space-between",
            mt: 4,
            pt: 2,
            ...{ borderTop: "1px solid", borderColor: "divider" },
          }}
        >
          <Typography variant="caption" color="text.secondary">
            stripe-sandbox-seeder
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Made for a clean slate.
          </Typography>
        </Stack>
      </Container>
      {run && (
        <BatchProgress
          key={run.id}
          completed={run.completed}
          total={run.total}
          results={run.results}
          running={running}
        />
      )}
      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        aria-labelledby="reset-title"
        aria-describedby="reset-description"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="reset-title">Reset Everything?</DialogTitle>
        <DialogContent>
          <DialogContentText id="reset-description">
            Reset all form choices and clear saved batch progress and results.
            Customers and subscriptions already created in Stripe will remain.
          </DialogContentText>
          <FormControlLabel
            sx={{ mt: 2 }}
            control={
              <Checkbox
                checked={keepApiKey}
                onChange={(e) => setKeepApiKey(e.target.checked)}
              />
            }
            label="Do not clear API key"
          />
          {resetError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {resetError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={resetEverything}
            disabled={running || catalogLoading}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
