"use client";
import { useRef } from "react";
import { Box, IconButton, Stack, TextField, Typography } from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import type { MetadataRow } from "@/lib/schema";
export function MetadataEditor({
  label,
  rows,
  onChange,
}: {
  label: string;
  rows: MetadataRow[];
  onChange: (rows: MetadataRow[]) => void;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const add = (i: number) => {
    onChange([
      ...rows.slice(0, i + 1),
      { key: "", value: "" },
      ...rows.slice(i + 1),
    ]);
    setTimeout(() => inputs.current[i + 1]?.focus(), 0);
  };
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Metadata
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Optional · Enter to add a row
        </Typography>
      </Stack>
      <Stack sx={{ gap: 1 }}>
        {rows.map((row, i) => (
          <Stack
            direction="row"
            key={i}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(i);
              }
            }}
            sx={{ gap: 1 }}
          >
            <TextField
              placeholder="Key"
              value={row.key}
              inputRef={(el) => {
                inputs.current[i] = el;
              }}
              slotProps={{
                htmlInput: {
                  "aria-label": `${label} metadata key ${i + 1}`,
                  maxLength: 40,
                },
              }}
              onChange={(e) =>
                onChange(
                  rows.map((r, j) =>
                    j === i ? { ...r, key: e.target.value } : r,
                  ),
                )
              }
            />
            <TextField
              placeholder="Value"
              value={row.value}
              slotProps={{
                htmlInput: {
                  "aria-label": `${label} metadata value ${i + 1}`,
                  maxLength: 500,
                },
              }}
              onChange={(e) =>
                onChange(
                  rows.map((r, j) =>
                    j === i ? { ...r, value: e.target.value } : r,
                  ),
                )
              }
            />
            <IconButton
              aria-label={`Add ${label} metadata row after ${i + 1}`}
              onClick={() => add(i)}
              size="small"
            >
              <AddRounded sx={{ fontSize: "small" }} />
            </IconButton>
            <IconButton
              aria-label={`Remove ${label} metadata row ${i + 1}`}
              onClick={() =>
                onChange(
                  rows.length === 1
                    ? [{ key: "", value: "" }]
                    : rows.filter((_, j) => j !== i),
                )
              }
              size="small"
            >
              <RemoveRounded sx={{ fontSize: "small" }} />
            </IconButton>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
