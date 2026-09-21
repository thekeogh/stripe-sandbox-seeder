"use client";

import { useState } from "react";
import {
  Box,
  Chip,
  Collapse,
  Container,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import KeyboardArrowUpRounded from "@mui/icons-material/KeyboardArrowUpRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";

export type SeedResult = {
  customerId: string;
  subscriptionId: string;
  name: string;
  email: string;
  status: string;
};
export function BatchProgress({
  completed,
  total,
  results,
  running,
}: {
  completed: number;
  total: number;
  results: SeedResult[];
  running: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const complete = completed === total;
  const title = complete
    ? "Your sandbox is ready"
    : running
      ? "Creating your customers…"
      : "Batch paused";
  return (
    <Paper
      component="section"
      aria-label="Batch progress"
      square
      elevation={8}
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        borderTop: "1px solid",
        borderColor: "divider",
        pb: "env(safe-area-inset-bottom)",
        boxShadow: "0 -6px 24px rgba(0, 0, 0, 0.3)",
      }}
    >
      <LinearProgress
        aria-label="Customers created"
        variant="determinate"
        value={(completed / total) * 100}
        sx={{ height: 3 }}
      />
      <Container
        maxWidth={false}
        sx={{ width: { xs: "100%", md: "90%" }, px: { xs: 2, sm: 3, md: 0 } }}
      >
        <Collapse in={expanded} id="batch-progress-details" unmountOnExit>
          <Box
            sx={{
              maxHeight: "min(50dvh, 360px)",
              overflowY: "auto",
              overscrollBehavior: "contain",
              py: 2,
              pr: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Every completed row has a customer and subscription.{" "}
              {completed > 100 ? "Showing the most recent 100." : ""}
            </Typography>
            {!results.length && (
              <Typography variant="body2" color="text.secondary">
                No completed pairs yet.
              </Typography>
            )}
            {results.map((result) => (
              <Box
                key={result.customerId}
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 1,
                  py: 1.5,
                  borderTop: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {result.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {result.email}
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  sx={{ gap: 2, alignItems: "center", flexWrap: "wrap" }}
                >
                  <Typography
                    component="a"
                    variant="caption"
                    href={`https://dashboard.stripe.com/test/customers/${result.customerId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Customer ↗
                  </Typography>
                  <Typography
                    component="a"
                    variant="caption"
                    href={`https://dashboard.stripe.com/test/subscriptions/${result.subscriptionId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Subscription ↗
                  </Typography>
                  <Chip size="small" label={result.status} />
                </Stack>
              </Box>
            ))}
          </Box>
        </Collapse>
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            gap: { xs: 1, sm: 2 },
            height: 56,
            minWidth: 0,
          }}
        >
          <Typography
            variant="body2"
            noWrap
            title={title}
            sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}
          >
            {title}
          </Typography>
          <Box role="status" aria-live="polite" sx={{ flexShrink: 0 }}>
            <Chip
              size="small"
              color={complete ? "success" : "default"}
              label={`${completed} / ${total} created`}
            />
          </Box>
          <Tooltip
            title={expanded ? "Hide batch details" : "Show batch details"}
          >
            <IconButton
              aria-label={
                expanded ? "Collapse batch details" : "Expand batch details"
              }
              aria-expanded={expanded}
              aria-controls="batch-progress-details"
              onClick={() => setExpanded((value) => !value)}
              sx={{ flexShrink: 0 }}
            >
              {expanded ? (
                <KeyboardArrowDownRounded />
              ) : (
                <KeyboardArrowUpRounded />
              )}
            </IconButton>
          </Tooltip>
        </Stack>
      </Container>
    </Paper>
  );
}
