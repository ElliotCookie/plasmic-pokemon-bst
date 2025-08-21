// pages/[[...catchall]].tsx
import * as React from "react";
import {
  PlasmicComponent,
  extractPlasmicQueryData,
  ComponentRenderData,
  PlasmicRootProvider,
} from "@plasmicapp/loader-nextjs";
import type { GetStaticPaths, GetStaticProps } from "next";
import Error from "next/error";
import { useRouter } from "next/router";
import { PLASMIC } from "@/plasmic-init";

/**
 * Plasmic loader page that:
 * - fetches Plasmic page data at build time (getStaticProps/getStaticPaths)
 * - mounts a client-side slider that POSTs to your PythonAnywhere backend
 * - shows an initial number fetched from /number on load
 * - displays multiply result in the multiplyBox child component
 */

export default function PlasmicLoaderPage(props: {
  plasmicData?: ComponentRenderData;
  queryCache?: Record<string, unknown>;
}) {
  const { plasmicData, queryCache } = props;
  const router = useRouter();

  // -----------------------
  // Top-level Hooks (must be here)
  // -----------------------
  const [sliderValues, setSliderValues] = React.useState({
  testSlider1: 0,
  totalPkmnBST: 0,
  bstSlider: 0,
});
  const [initialNumber, setInitialNumber] = React.useState<string>("loading...");
  const [multiplyResultPa, setMultiplyResultPa] = React.useState<number | null>(null);

  // --- Pokémon team names state (placeholders 1..6) ---
  const [pkmnTeamNames, setPkmnTeamNames] = React.useState<string[]>(
  Array.from({ length: 6 }, (_, i) => String(i + 1)));

  // Metrics derived from the last optimiser result (expandable)
  const [teamMetrics, setTeamMetrics] = React.useState<{
    avgBst: number | null;
  }>({
    avgBst: null,
  });

  // Backend base URL: use env in production, fallback to your PA domain for local dev
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://elliotcookie.pythonanywhere.com";
  const OPTIMISE_ENDPOINT = `${BACKEND}/api/optimise`;

  // Map UI slider keys -> solver constraint names (single source of truth)
  // Add new mappings here as you create sliders.
  const SLIDER_TO_CONSTRAINT: Record<string, string> = {
    bstSlider: "MAX_POKE_BST",
    totalPkmnBST: "MAX_POKE_BST",
    // Example future entries:
    // teamSizeSlider: "TEAM_SIZE",
    // maxLegendariesSlider: "MAX_LEGENDARIES",
  };


  // --- TypeScript interfaces for defensive typing ---
  interface TeamMember {
    name?: string | null;
    type1?: string | null;
    type2?: string | null;
    bst?: number | null;
    stats?: Record<string, unknown> | null;
  }

  interface OptimiserResponse {
  error: boolean;
  status?: string;
  objective_value?: number;
  team?: TeamMember[];
  type_weakness_totals?: Record<string, number>;
}


  // type guard: returns true if obj looks like { result: number | string }
  function isResultObject(obj: unknown): obj is { result: number | string } {
    if (obj === null || obj === undefined) return false;
    if (typeof obj !== "object") return false;

    const o = obj as Record<string, unknown>;

    // Use hasOwnProperty to avoid inherited properties
    if (!Object.prototype.hasOwnProperty.call(o, "result")) {
      return false;
    }

    const val = o["result"];
    return typeof val === "number" || typeof val === "string";
  }

/*   // --- Type guard to validate backend response shape ---
  function isOptimiserResponse(obj: unknown): obj is OptimiserResponse {
    if (!obj || typeof obj !== "object") return false;
    const o = obj as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(o, "team")) return false;
    const team = o.team;
    if (!Array.isArray(team)) return false;
    // ensure each team entry is either an object or undefined/null
    return team.every((t) => t === null || typeof t === "object" || typeof t === "string");
  }


  // Helper to safely get the name for a given index
  function getNameForIndex(i: number): string {
    if (i < 0) return "";
    if (i < pkmnTeamNames.length) return pkmnTeamNames[i] ?? "";
    return "";
  }
 */




  // Fetch initial number once on client-side mount
  React.useEffect(() => {
    console.log("📥 Fetching initial /number from PythonAnywhere...");
    fetch(`${BACKEND}/number`)
      .then((res) => res.json())
      .then((data) => {
        console.log("API fetch /number result:", data);
        if (data && data.result !== undefined) {
          setInitialNumber(String(data.result));
        }
      })
      .catch((err) => {
        console.error("Error fetching initial number:", err);
        setInitialNumber("error");
      });
  }, [BACKEND]);


// at top of the component
const didFetchOptimiser = React.useRef(false);

// Optimiser fetch — runs once on mount (or until you reset didFetchOptimiser.current)
React.useEffect(() => {
  if (didFetchOptimiser.current) return; // already fetched once
  didFetchOptimiser.current = true;

  console.log("📥 Fetching optimiser /api/optimise from PythonAnywhere...");

  fetch(`${OPTIMISE_ENDPOINT}`)
    .then((res) => res.json() as Promise<OptimiserResponse>)
    .then((data) => {
      console.log("API fetch /api/optimise result:", data);

      // defensive: if data.team is not an array, keep placeholders
      if (!data || !Array.isArray(data.team)) {
        console.warn("Unexpected /api/optimise response shape, keeping placeholders:", data);
        return;
      }

      // Build names array from returned team entries
      const returnedTeam = data.team as (TeamMember | null | string)[];
      const extractedNames: string[] = returnedTeam.map((entry) => {
        if (!entry) return ""; // empty if missing
        if (typeof entry === "string") return entry;
        return entry.name ?? "";
      });

      // We have 6 UI slots. Trim or pad to 6.
      const MAX_SLOTS = 6;
      const paddedNames = extractedNames.slice(0, MAX_SLOTS);
      while (paddedNames.length < MAX_SLOTS) {
        // fill empty slots with empty string or placeholder like "—"
        paddedNames.push("");
      }

      console.log("DEBUG: setting pkmnTeamNames ->", paddedNames);
      setPkmnTeamNames(paddedNames);
    })
    .catch((err) => {
      console.error("Error fetching /api/optimise:", err);
      // keep placeholders on error
    });
}, [OPTIMISE_ENDPOINT]); // safe: only depends on endpoint; guarded by didFetchOptimiser


async function onValueChange(sliderName: string, newValue: number) {
  try {
    const updated = { ...sliderValues, [sliderName]: newValue };
    setSliderValues(updated);
    console.log(`🔧 Slider "${sliderName}" →`, newValue);

    if (sliderName === "testSlider1") {
      // ---- /multiply branch ----
      console.log("📤 POST → /multiply:", { value: newValue });
      const res = await fetch(`${BACKEND}/multiply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newValue }),
      });

      const txt = await res.text();
      let parsed: unknown = null;
      try {
        parsed = txt ? JSON.parse(txt) : null;
      } catch (e) {
        console.error("JSON parse error (/multiply):", e);
        setMultiplyResultPa(null);
        return;
      }

      if (res.ok && isResultObject(parsed)) {
        const num = Number(parsed.result);
        if (!Number.isNaN(num)) {
          setMultiplyResultPa(num);
          console.log("✅ /multiply result:", num);
        } else {
          console.warn("Non-numeric /multiply result:", parsed.result);
          setMultiplyResultPa(null);
        }
      } else {
        console.warn("API error or unexpected /multiply shape:", res.status, parsed);
        setMultiplyResultPa(null);
      }
      return;
    }

    // ---- /api/optimise branch ----
    // Build a solver-shaped payload deterministically using SLIDER_TO_CONSTRAINT
    const updatedTyped = updated as Record<string, number | string>;
    const solverPayload: Record<string, number | string> = {};
    Object.keys(updatedTyped).forEach((k: string) => {
      const mapped = SLIDER_TO_CONSTRAINT[k];
      if (mapped) {
        solverPayload[mapped] = updatedTyped[k];
      }
    });

    // Fallback: if nothing mapped yet, send the full updated object (keeps behaviour safe)
    const bodyToSend: Record<string, unknown> =
      Object.keys(solverPayload).length > 0 ? solverPayload : updatedTyped;

    console.log("📤 POST → /api/optimise with payload:", bodyToSend);
    const res = await fetch(OPTIMISE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyToSend),
    });

    const txt = await res.text();
    let parsed: unknown = null;
    try {
      parsed = txt ? JSON.parse(txt) : null;
    } catch (e) {
      console.error("JSON parse error (/api/optimise):", e);
      return;
    }

    const looksLikeTeamArray =
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as Record<string, unknown>).team);

    if (res.ok && looksLikeTeamArray) {
      const team = (parsed as { team: unknown[] }).team;
      const names = team.map((entry, i) => {
        if (typeof entry === "string") return entry;
        if (
          entry &&
          typeof entry === "object" &&
          "name" in (entry as Record<string, unknown>) &&
          typeof (entry as Record<string, unknown>).name === "string"
        ) {
          return (entry as Record<string, unknown>).name as string;
        }
        return String(i + 1);
      });

      const padded =
        names.length >= 6
          ? names.slice(0, 6)
          : [...names, ...Array.from({ length: 6 - names.length }, (_, i) => String(names.length + i + 1))];

      setPkmnTeamNames(padded);
      console.log("✅ Optimiser team names:", padded);

      type TeamMemberLocal = {
        name?: string | null;
        type1?: string | null;
        type2?: string | null;
        bst?: number | null;
        stats?: Record<string, number> | null;
      };

      const typedTeam = (team as unknown[]) as TeamMemberLocal[];

      // 1) total BST and average BST
      const totalBst = typedTeam.reduce((acc, m) => acc + (m.bst ?? 0), 0);
      const avgBst = typedTeam.length ? totalBst / typedTeam.length : null;

      // Save metrics into state for the UI
      setTeamMetrics({
        avgBst: avgBst !== null ? Number(avgBst) : null,
      });
      console.log("[Metrics] avgBst:", avgBst, "totalBst:", totalBst);

    } else {
      console.warn("API error or unexpected optimiser shape:", res.status, parsed);
    }
  } catch (err) {
    console.error("Error in onValueChange:", err);
  }
}


  // Keep the Plasmic required early-return after hooks.
  if (!plasmicData || plasmicData.entryCompMetas.length === 0) {
    return <Error statusCode={404} />;
  }
  const pageMeta = plasmicData.entryCompMetas[0];

  // Ensure pkmnTeamNames is always an array of length 6 (use placeholders if needed)
  const safeNames = Array.isArray(pkmnTeamNames) ? pkmnTeamNames : Array(6).fill("");


  // Map component props to Plasmic children
  const baseProps = {
    testSlider1: {
      Value: sliderValues.testSlider1 ?? 0,
      onValueChange: (val: number) => onValueChange("testSlider1", val),
    },
    totalPkmnBST: {
      Value: sliderValues.totalPkmnBST ?? 0,
      onValueChange: (val: number) => onValueChange("totalPkmnBST", val),
    },
    bstSlider: {   
      Value: sliderValues.bstSlider ?? 0,
      onValueChange: (val: number) => onValueChange("bstSlider", val),
    },
    apiTestTextBox: {
      text: initialNumber,
    },
    multiplyBox: {
      valueMb: multiplyResultPa !== null ? String(multiplyResultPa) : "",
    },
    teamNames: safeNames,

    bstOfTeam: {
      svPkmnBst: teamMetrics.avgBst !== null ? String(Math.round(teamMetrics.avgBst)) : "",
    },
  };

  const cardProps = safeNames.reduce<Record<string, unknown>>((acc, nm, idx) => {
    const cardNumber = idx + 1; // 1..6
    acc[`pkmnCard${cardNumber}`] = { [`pkmnName${cardNumber}`]: nm };
    return acc;
  }, {});
  // Merge base props + card props into the object we actually pass to Plasmic
  const componentProps = { ...baseProps, ...cardProps };
  
  console.log("DEBUG componentProps (before render):", { basePropsSnapshot: {
    svPkmnBst: teamMetrics.avgBst !== null ? String(teamMetrics.avgBst) : "", 
    teamMetrics
  }});


  return (
    <PlasmicRootProvider
      loader={PLASMIC}
      prefetchedData={plasmicData}
      prefetchedQueryData={queryCache as Record<string, unknown> | undefined}
      pageRoute={pageMeta.path}
      pageParams={pageMeta.params}
      pageQuery={router.query}
    >
      <PlasmicComponent component={pageMeta.displayName} componentProps={componentProps} />
    </PlasmicRootProvider>
  );
}

/**
 * keep getStaticProps/getStaticPaths generated by Plasmic so pages are discovered and pre-rendered.
 * These were the typical Plasmic-generated implementations — they must exist for the catchall route.
 */

export const getStaticProps: GetStaticProps = async (context) => {
  const { catchall } = context.params ?? {};
  const plasmicPath =
    typeof catchall === "string"
      ? catchall
      : Array.isArray(catchall)
      ? `/${catchall.join("/")}`
      : "/";
  const plasmicData = await PLASMIC.maybeFetchComponentData(plasmicPath);
  if (!plasmicData) {
    // non-Plasmic catch-all
    return { props: {} };
  }
  const pageMeta = plasmicData.entryCompMetas[0];

  // extractPlasmicQueryData runs a prepass to gather data used by components (keep as-is)
  const queryCache = await extractPlasmicQueryData(
    <PlasmicRootProvider loader={PLASMIC} prefetchedData={plasmicData} pageRoute={pageMeta.path} pageParams={pageMeta.params}>
      <PlasmicComponent component={pageMeta.displayName} />
    </PlasmicRootProvider>
  );

  return { props: { plasmicData, queryCache }, revalidate: 60 };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const pageModules = await PLASMIC.fetchPages();
  return {
    paths: pageModules.map((mod) => ({
      params: {
        catchall: mod.path.substring(1).split("/"),
      },
    })),
    fallback: "blocking",
  };
};
