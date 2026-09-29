import Landing from "@/components/Landing";
import { nvidiaModel } from "@/lib/env";

/** `moonshotai/kimi-k3` -> `kimi-k3`, so the label never drifts from config. */
function shortModelName(model: string): string {
  const parts = model.split("/");
  return parts[parts.length - 1] || model;
}

export default function HomePage() {
  return <Landing modelLabel={`NVIDIA NIM · ${shortModelName(nvidiaModel())}`} />;
}
