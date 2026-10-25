import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  createBlankNetwork,
  deleteNetwork,
  generateNetwork,
  getNetworks,
  type NetworkForm,
} from "../lib/api";

const FORM_FIELDS = ["routers", "firewalls", "switches", "access_points", "hubs", "repeaters", "servers", "hosts"] as const;

const templates = [
  ["campus", "College campus"],
  ["office", "Small office"],
  ["enterprise", "Enterprise HQ"],
  ["data-center", "Data centre"],
  ["isp-backbone", "ISP backbone"],
  ["home", "Smart home"],
  ["wireless-mesh", "Wireless mesh"],
  ["branch", "Branch WAN"],
  ["hospital", "Hospital"],
  ["school", "School lab"],
  ["hotel", "Hotel Wi-Fi"],
  ["factory", "Industrial plant"],
  ["retail", "Retail chain"],
  ["bank", "Bank network"],
  ["cloud", "Hybrid cloud"],
  ["iot", "IoT deployment"],
  ["voip", "VoIP office"],
  ["security", "Security lab"],
  ["rip-lab", "RIP practice"],
  ["ospf-lab", "OSPF multi-area"],
] as const;

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const networks = useQuery({ queryKey: ["networks"], queryFn: getNetworks });
  const [name, setName] = useState("My network lab");
  const [category, setCategory] = useState("campus");
  const [protocol, setProtocol] = useState("ospf");
  const [count, setCount] = useState(50);
  const [prompt, setPrompt] = useState(
    "Three-floor college network with 45 devices, OSPF, one firewall",
  );
  const [mode, setMode] = useState<"prompt" | "form">("prompt");
  const [form, setForm] = useState<NetworkForm>({ protocol: "ospf", style: "hierarchical", routers: 3, firewalls: 1, switches: 3, access_points: 1, hubs: 0, repeaters: 0, servers: 2, hosts: 20, redundancy: true });
  const formTotal = FORM_FIELDS.reduce((sum, key) => sum + form[key], 0);
  const generate = useMutation({
    mutationFn: generateNetwork,
    onSuccess: ({ network, answered_by, notes }) => {
      queryClient.invalidateQueries({ queryKey: ["networks"] });
      const params = new URLSearchParams({ planner: answered_by });
      if (notes.length) params.set("notes", notes.join(" · "));
      navigate(`/simulator/${network.id}?${params}`);
    },
  });
  const createBlank = useMutation({
    mutationFn: createBlankNetwork,
    onSuccess: (network) => {
      queryClient.invalidateQueries({ queryKey: ["networks"] });
      navigate(`/simulator/${network.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: deleteNetwork,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["networks"] }),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    generate.mutate(mode === "form" ? { name, category, device_count: formTotal, protocol: form.protocol, form } : { name, category, device_count: count, protocol, prompt });
  }
  return (
    <div className="dashboard-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">STUDENT WORKSPACE</p>
          <h1>Network laboratories</h1>
          <p>
            Design manually, generate from a template, or describe a network to
            AI.
          </p>
        </div>
        <span className="mode-badge">SIMULATED · REALISTIC TIMING</span>
      </header>
      <section className="dashboard-grid">
        <article className="panel generate-panel">
          <h2>Create or generate a network</h2>
          <form onSubmit={submit}>
            <label>
              Network name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <button
              className="manual-button"
              disabled={createBlank.isPending || !name.trim()}
              type="button"
              onClick={() => createBlank.mutate(name.trim())}
            >
              {createBlank.isPending
                ? "Creating blank canvas…"
                : "Create blank network — build it myself"}
            </button>
            <div className="form-divider">
              <span>OR GENERATE</span>
            </div>
            <div className="segmented" role="tablist" aria-label="How to generate">
              <button type="button" role="tab" aria-selected={mode === "prompt"} className={mode === "prompt" ? "active" : ""} onClick={() => setMode("prompt")}>
                Describe it (AI)
              </button>
              <button type="button" role="tab" aria-selected={mode === "form"} className={mode === "form" ? "active" : ""} onClick={() => setMode("form")}>
                Detailed form
              </button>
            </div>
            {mode === "prompt" ? (
              <>
                <label>
                  Plain-English request
                  <textarea value={prompt} maxLength={2000} onChange={(event) => setPrompt(event.target.value)} />
                </label>
                <div className="form-row">
                  <label>
                    Lab type
                    <select value={category} onChange={(event) => setCategory(event.target.value)}>
                      {templates.map(([id, label]) => (
                        <option value={id} key={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Default routing
                    <select value={protocol} onChange={(event) => setProtocol(event.target.value)}>
                      <option value="static">Static</option>
                      <option value="rip">RIP</option>
                      <option value="ospf">OSPF</option>
                    </select>
                  </label>
                  <label>
                    Default devices
                    <input type="number" min="2" max="50" value={count} onChange={(event) => setCount(Number(event.target.value))} />
                  </label>
                </div>
                <p className="hint">The AI only proposes device counts and a layout as JSON; the server validates them (max 50 devices, unique IPs, connected) and builds the network. If AI is unavailable a local rule-based planner is used and labelled.</p>
              </>
            ) : (
              <>
                <div className="form-grid">
                  {FORM_FIELDS.map((key) => (
                    <label key={key}>
                      {key.replace("_", " ")}
                      <input type="number" min={0} max={48} value={form[key]} onChange={(event) => setForm({ ...form, [key]: Math.max(0, Number(event.target.value)) })} />
                    </label>
                  ))}
                  <label>
                    Routing
                    <select value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value })}>
                      <option value="static">Static</option>
                      <option value="rip">RIP</option>
                      <option value="ospf">OSPF</option>
                    </select>
                  </label>
                  <label>
                    Layout
                    <select value={form.style} onChange={(event) => setForm({ ...form, style: event.target.value })}>
                      {["hierarchical", "ring", "mesh", "star", "leaf-spine", "bus"].map((style) => (
                        <option key={style}>{style}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="check">
                  <input type="checkbox" checked={form.redundancy} onChange={(event) => setForm({ ...form, redundancy: event.target.checked })} />
                  Redundant links (backup paths)
                </label>
                <p className={formTotal > 50 ? "form-error" : "hint"}>
                  {formTotal}/50 devices{formTotal > 50 ? " — the server will reduce this to 50" : ""}. The form never calls AI.
                </p>
              </>
            )}
            <button
              className="primary-button"
              disabled={generate.isPending}
              type="submit"
            >
              {generate.isPending ? "Building topology…" : mode === "form" ? "Build from form and open" : "Generate with AI and open"}
            </button>
            {(generate.isError || createBlank.isError) && (
              <p role="alert" className="form-error">
                {generate.error?.message ?? createBlank.error?.message}
              </p>
            )}
          </form>
        </article>
        <article className="panel saved-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">POSTGRESQL</p>
              <h2>Saved networks</h2>
            </div>
            <span>{networks.data?.length ?? 0}</span>
          </div>
          {networks.isLoading ? (
            <p>Loading networks…</p>
          ) : (
            <div className="saved-list">
              {networks.data?.map((network) => (
                <div className="saved-network" key={network.id}>
                  <button onClick={() => navigate(`/simulator/${network.id}`)}>
                    <strong>{network.name}</strong>
                    <small>Topology {network.topology_version}</small>
                  </button>
                  <button
                    className="danger-button"
                    aria-label={`Delete ${network.name}`}
                    onClick={() =>
                      confirm(`Delete ${network.name}?`) &&
                      remove.mutate(network.id)
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
      <section className="template-section">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">20 READY-MADE LABS</p>
            <h2>Start from a 50-device topology</h2>
          </div>
        </div>
        <div className="template-grid">
          {templates.map(([id, label], index) => (
            <button
              key={id}
              className="template-card"
              onClick={() =>
                generate.mutate({
                  name: `${label} ${Date.now().toString().slice(-4)}`,
                  category: id,
                  device_count: 50,
                  protocol: id === "rip-lab" ? "rip" : "ospf",
                  prompt: `Create a 50 device ${label} network`,
                })
              }
            >
              <span className="template-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <strong>{label}</strong>
              <small>50 devices · {id === "rip-lab" ? "RIP" : "OSPF"}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
