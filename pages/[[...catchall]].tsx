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
  const [sliderValue, setSliderValue] = React.useState<number>(0);
  const [initialNumber, setInitialNumber] = React.useState<string>("loading...");
  const [multiplyResultPa, setMultiplyResultPa] = React.useState<number | null>(null);

  // --- Pokémon team names state (placeholders 1..6) ---
  const [pkmnTeamNames, setPkmnTeamNames] = React.useState<string[]>(
  Array.from({ length: 6 }, (_, i) => String(i + 1)));

  // Backend base URL: use env in production, fallback to your PA domain for local dev
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://elliotcookie.pythonanywhere.com";
  const OPTIMISE_ENDPOINT = `${BACKEND}/api/optimise`;

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


React.useEffect(() => {
  console.log("📥 Fetching optimiser /api/optimise from PythonAnywhere...");

  // Avoid re-fetching if we've already populated real names
  const isPlaceholder = pkmnTeamNames.every((v, idx) => v === String(idx + 1));
  if (!isPlaceholder) return;

  fetch(`${OPTIMISE_ENDPOINT}`)
    .then((res) => res.json() as Promise<OptimiserResponse>) // <- use the interface here
    .then((data) => {
      console.log("API fetch /api/optimise result:", data);
      if (data && Array.isArray(data.team)) {
        const names = Array.from({ length: 6 }, (_, i) => {
          const entry = data.team![i];
          if (!entry) return String(i + 1);
          if (typeof entry === "string") return entry;
          return entry.name ?? String(i + 1);
        });
        setPkmnTeamNames(names);
      } else {
        console.warn("Unexpected /api/optimise response shape, keeping placeholders:", data);
      }
    })
    .catch((err) => {
      console.error("Error fetching /api/optimise:", err);
      // keep placeholders on error (no set)
    });
}, [OPTIMISE_ENDPOINT, pkmnTeamNames]);





  // Handler called when slider changes in Plasmic
  async function onValueChange(newSliderValue: number) {
  try {
    // immediate UI update
    setSliderValue(newSliderValue);
    console.log("Slider event - newSliderValue:", newSliderValue);

    // POST to backend
    console.log("📤 About to POST to /multiply with:", { value: newSliderValue });
    const res = await fetch(`${BACKEND}/multiply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: newSliderValue }),
    });

    console.log("Response status:", res.status);

    // Read as text first (robust if backend returns HTML/text)
    const txt = await res.text();

    // Try to parse JSON (safe: won't throw because we control try/catch)
    let parsed: unknown = null;
    try {
      parsed = txt ? JSON.parse(txt) : null;
    } catch (err) {
    // make sure the caught error is logged and used so it's not flagged
    console.error("Error calling API:", err);
    setMultiplyResultPa(null);
    }

    // Validate parsed shape with type guard
    if (res.ok && isResultObject(parsed)) {
      // result might be string or number — normalise to number
      const numericResult = Number(parsed.result);
      if (!Number.isNaN(numericResult)) {
        setMultiplyResultPa(numericResult);
        console.log("API returned numeric result:", numericResult);
      } else {
        console.warn("API returned result that is not numeric:", parsed.result);
        setMultiplyResultPa(null);
      }
    } else {
      console.warn("API error or unexpected response shape:", res.status, parsed);
      setMultiplyResultPa(null);
    }
  } catch (err) {
    console.error("Error calling API:", err);
    setMultiplyResultPa(null);
  }
}


  // Keep the Plasmic required early-return after hooks.
  if (!plasmicData || plasmicData.entryCompMetas.length === 0) {
    return <Error statusCode={404} />;
  }
  const pageMeta = plasmicData.entryCompMetas[0];

  // Map component props to Plasmic children (names must match your Plasmic component display names / props)
  const componentProps = {
    testSlider1: {
      // NOTE: make sure the prop name here (value) matches the prop name in Plasmic for the slider
      Value: sliderValue, // if Plasmic expects `Value` (capital V) — use that. Match what you configured.
      onValueChange: onValueChange,
    },
    apiTestTextBox: {
      // the text prop in your Plasmic text box (match exactly)
      text: initialNumber,
    },
    multiplyBox: {
      // the prop name you set in Plasmic for the multiply box (valueMb or similar). Adjust if different.
      valueMb: multiplyResultPa !== null ? String(multiplyResultPa) : "",
    },
    items:pkmnTeamNames
    teamNames: pkmnTeamNames,
    
  };


  
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
