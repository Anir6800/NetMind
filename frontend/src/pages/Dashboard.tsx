import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { deleteNetwork, generateNetwork, getNetworks } from "../lib/api";

const templates = [
  ["campus", "College campus"], ["office", "Small office"], ["enterprise", "Enterprise HQ"], ["data-center", "Data centre"], ["isp-backbone", "ISP backbone"],
  ["home", "Smart home"], ["wireless-mesh", "Wireless mesh"], ["branch", "Branch WAN"], ["hospital", "Hospital"], ["school", "School lab"],
  ["hotel", "Hotel Wi-Fi"], ["factory", "Industrial plant"], ["retail", "Retail chain"], ["bank", "Bank network"], ["cloud", "Hybrid cloud"],
  ["iot", "IoT deployment"], ["voip", "VoIP office"], ["security", "Security lab"], ["rip-lab", "RIP practice"], ["ospf-lab", "OSPF multi-area"],
] as const;

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const networks = useQuery({ queryKey: ["networks"], queryFn: getNetworks });
  const [name, setName] = useState("My network lab");
  const [category, setCategory] = useState("campus");
  const [protocol, setProtocol] = useState("ospf");
  const [count, setCount] = useState(50);
  const [prompt, setPrompt] = useState("Create a three-floor campus network with redundant routers");
  const generate = useMutation({ mutationFn: generateNetwork, onSuccess: ({ network }) => { queryClient.invalidateQueries({ queryKey: ["networks"] }); navigate(`/simulator/${network.id}`); } });
  const remove = useMutation({ mutationFn: deleteNetwork, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["networks"] }) });
  function submit(event: FormEvent) { event.preventDefault(); generate.mutate({ name, category, device_count: count, protocol, prompt }); }
  return <div className="dashboard-page"><header className="workspace-heading"><div><p className="eyebrow">STUDENT WORKSPACE</p><h1>Network laboratories</h1><p>Design manually, generate from a template, or describe a network to AI.</p></div><span className="mode-badge">SIMULATED · REALISTIC TIMING</span></header><section className="dashboard-grid"><article className="panel generate-panel"><h2>Generate a network</h2><form onSubmit={submit}><label>Network name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><div className="form-row"><label>Type<select value={category} onChange={(event) => setCategory(event.target.value)}>{templates.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><label>Routing<select value={protocol} onChange={(event) => setProtocol(event.target.value)}><option value="static">Static</option><option value="rip">RIP</option><option value="ospf">OSPF</option></select></label><label>Devices<input type="number" min="6" max="50" value={count} onChange={(event) => setCount(Number(event.target.value))} /></label></div><label>AI prompt<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label><button className="primary-button" disabled={generate.isPending} type="submit">{generate.isPending ? "Building topology…" : "Generate and open"}</button>{generate.isError && <p role="alert" className="form-error">{generate.error.message}</p>}</form></article><article className="panel saved-panel"><div className="panel-heading"><div><p className="eyebrow">POSTGRESQL</p><h2>Saved networks</h2></div><span>{networks.data?.length ?? 0}</span></div>{networks.isLoading ? <p>Loading networks…</p> : <div className="saved-list">{networks.data?.map((network) => <div className="saved-network" key={network.id}><button onClick={() => navigate(`/simulator/${network.id}`)}><strong>{network.name}</strong><small>Topology {network.topology_version}</small></button><button className="danger-button" aria-label={`Delete ${network.name}`} onClick={() => confirm(`Delete ${network.name}?`) && remove.mutate(network.id)}>×</button></div>)}</div>}</article></section><section className="template-section"><div className="panel-heading"><div><p className="eyebrow">20 READY-MADE LABS</p><h2>Start from a 50-device topology</h2></div></div><div className="template-grid">{templates.map(([id, label], index) => <button key={id} className="template-card" onClick={() => generate.mutate({ name: `${label} ${Date.now().toString().slice(-4)}`, category: id, device_count: 50, protocol: id === "rip-lab" ? "rip" : "ospf", prompt: `Create a 50 device ${label} network` })}><span className="template-number">{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong><small>50 devices · {id === "rip-lab" ? "RIP" : "OSPF"}</small></button>)}</div></section></div>;
}
