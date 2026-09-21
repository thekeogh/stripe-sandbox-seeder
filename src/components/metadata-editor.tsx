"use client";
import { useRef, type KeyboardEvent } from "react";
import {
  Box,
  IconButton,
  ListSubheader,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import {
  metadataTypes,
  type MetadataRow,
  type MetadataType,
} from "@/lib/metadata";

const groups = [...new Set(metadataTypes.map((t) => t.group))];
export function MetadataEditor({
  label,
  rows,
  onChange,
  disabled = false,
}: {
  label: string;
  rows: MetadataRow[];
  onChange: (rows: MetadataRow[]) => void;
  disabled?: boolean;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const update = (index: number, patch: Partial<MetadataRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const add = (i: number) => {
    onChange([
      ...rows.slice(0, i + 1),
      { key: "", value: "" },
      ...rows.slice(i + 1),
    ]);
    setTimeout(() => inputs.current[i + 1]?.focus(), 0);
  };
  const enter = (event: KeyboardEvent, i: number) => {
    // Select handles Enter itself: only text/number inputs insert a row.
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      add(i);
    }
  };
  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", gap: 1, mb: 1.5 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Metadata
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Optional · Enter to add a row
        </Typography>
      </Stack>
      <Stack sx={{ gap: 1.5 }}>
        {rows.map((row, i) => {
          const type = row.type ?? "custom";
          const option = metadataTypes.find((t) => t.id === type);
          const fieldName = (field: string) =>
            `${label} metadata ${field} ${i + 1}`;
          return (
            <Box
              key={i}
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr) minmax(0, 1fr) auto",
                  sm: "minmax(0, 1fr) minmax(0, 1.15fr) minmax(0, 1.3fr) auto",
                },
                gap: 1,
                alignItems: "start",
              }}
            >
              <TextField
                placeholder="Key"
                value={row.key}
                disabled={disabled}
                inputRef={(el) => {
                  inputs.current[i] = el;
                }}
                onKeyDown={(e) => enter(e, i)}
                slotProps={{
                  htmlInput: { "aria-label": fieldName("key"), maxLength: 40 },
                }}
                onChange={(e) => update(i, { key: e.target.value })}
              />
              <TextField
                select
                value={type}
                disabled={disabled}
                slotProps={{
                  select: {
                    SelectDisplayProps: { "aria-label": fieldName("type") },
                    MenuProps: {
                      slotProps: { paper: { sx: { maxHeight: 360 } } },
                    },
                  },
                }}
                onChange={(e) =>
                  update(i, { type: e.target.value as MetadataType })
                }
              >
                <MenuItem value="custom">Custom text</MenuItem>
                {groups.flatMap((group) => [
                  <ListSubheader
                    key={group}
                    sx={{
                      lineHeight: "32px",
                      bgcolor: "background.paper",
                      color: "primary.main",
                      fontSize: 12,
                    }}
                  >
                    {group}
                  </ListSubheader>,
                  ...metadataTypes
                    .filter((t) => t.group === group)
                    .map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.label}
                      </MenuItem>
                    )),
                ])}
              </TextField>
              <Box
                sx={{
                  minWidth: 0,
                  gridColumn: { xs: "1 / -1", sm: 3 },
                  gridRow: { xs: 2, sm: 1 },
                }}
              >
                {type === "custom" ? (
                  <TextField
                    placeholder="Value"
                    value={row.value}
                    disabled={disabled}
                    onKeyDown={(e) => enter(e, i)}
                    slotProps={{
                      htmlInput: {
                        "aria-label": fieldName("value"),
                        maxLength: 500,
                      },
                    }}
                    onChange={(e) => update(i, { value: e.target.value })}
                  />
                ) : type === "integer" || type === "decimal" ? (
                  <Box>
                    <Stack direction="row" sx={{ gap: 1 }}>
                      {(["min", "max"] as const).map((bound) => (
                        <TextField
                          key={bound}
                          label={bound === "min" ? "Min" : "Max"}
                          type="number"
                          value={row[bound] ?? (bound === "min" ? "0" : "1000")}
                          disabled={disabled}
                          onKeyDown={(e) => enter(e, i)}
                          slotProps={{
                            htmlInput: {
                              "aria-label": fieldName(bound),
                              step: type === "decimal" ? "0.01" : "1",
                              min: -1_000_000_000,
                              max: 1_000_000_000,
                            },
                          }}
                          onChange={(e) =>
                            update(i, { [bound]: e.target.value })
                          }
                        />
                      ))}
                    </Stack>
                    {type === "decimal" && (
                      <Typography variant="caption" color="text.secondary">
                        2 decimal places
                      </Typography>
                    )}
                  </Box>
                ) : type === "shortId" ? (
                  <TextField
                    label="Length"
                    type="number"
                    value={row.length ?? "12"}
                    disabled={disabled}
                    onKeyDown={(e) => enter(e, i)}
                    slotProps={{
                      htmlInput: {
                        "aria-label": fieldName("length"),
                        min: 1,
                        max: 100,
                        step: 1,
                      },
                    }}
                    onChange={(e) => update(i, { length: e.target.value })}
                  />
                ) : (
                  <Box
                    sx={{
                      minHeight: 40,
                      display: "flex",
                      alignItems: "center",
                      px: 1,
                      border: "1px dashed",
                      borderColor: "divider",
                      borderRadius: 1,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ overflowWrap: "anywhere" }}
                    >
                      {type === "pastDate" || type === "futureDate"
                        ? option?.example
                        : `e.g. ${option?.example}`}
                    </Typography>
                  </Box>
                )}
              </Box>
              <Stack
                direction="row"
                sx={{ gridColumn: { xs: 3, sm: 4 }, gridRow: 1, pt: 0.5 }}
              >
                <IconButton
                  disabled={disabled}
                  aria-label={`Add ${label} metadata row after ${i + 1}`}
                  onClick={() => add(i)}
                  size="small"
                >
                  <AddRounded fontSize="small" />
                </IconButton>
                <IconButton
                  disabled={disabled}
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
                  <RemoveRounded fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          );
        })}
      </Stack>
      {rows.some((row) => row.type && row.type !== "custom") && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1.5 }}
        >
          Faker values are generated separately for each {label.toLowerCase()}.
          Examples are illustrative; all values are saved to Stripe as text.
        </Typography>
      )}
    </Box>
  );
}
