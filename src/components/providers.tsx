"use client";
import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#a59bff" },
    secondary: { main: "#79dbb6" },
    background: { default: "#111216", paper: "#1a1b21" },
    text: { primary: "#eeedf4", secondary: "#a5a5b5" },
    divider: "#30313b",
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontWeight: 650, letterSpacing: "-1.2px" },
    h6: { fontWeight: 600, fontSize: "1.05rem" },
    button: { textTransform: "none", fontWeight: 600 },
    body2: { lineHeight: 1.65 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8, background: "#15161b", fontSize: 14 },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 6, fontSize: 12 } } },
  },
});
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
