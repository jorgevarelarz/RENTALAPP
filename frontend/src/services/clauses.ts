import axios from "axios";

export async function fetchClauses(region: string, version = "1.0.0") {
  const { data } = await axios.get("/api/clauses", { params: { region, version } });
  return data; // { version, region, items: [{id,label,version,paramsMeta}] }
}
