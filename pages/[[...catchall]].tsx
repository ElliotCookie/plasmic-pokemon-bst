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

type Props = {
  plasmicData?: ComponentRenderData;
  queryCache?: Record<string, unknown>;
};

export default function PlasmicLoaderPage(props: Props) {
  const { plasmicData, queryCache } = props;
  const router = useRouter();

  // Slider value (TypeScript variable name makes it obvious it's our local state)
  const [sliderValueTs, setSliderValueTs] = React.useState<number>(0);

  // Text shown in apiTestTextBox (string)
  const [apiTextBoxValue, setApiTextBoxValue] = React.useState<string>("loading...");

  // Value to show in multiplyBox (result from PythonAnywhere)
  const [multiplyBoxValue, setMultiplyBoxValue] = React.useState<number | null>(null);

  if (!plasmicData || plasmicData.entryCompMetas.length === 0) {
    return <Error statusCode={404} />;
  }
  const pageMeta = plasmicData.entryCompMetas[0];

  // Fetch a simple number on mount (example: /number endpoint that returns {result: 43})
  React.useEffect(() => {
    (async () => {
      try {
        console.log("📥 Fetching initial /number from PythonAnywhere...");
        const res = await fetch("https://elliotcookie.pythonanywhere.com/number");
        const json = await res.json();
        console.log("API fetch /number result:", json);
        if (json && json.result !== undefined) {
          setApiTextBoxValue(String(json.result));
        }
      } catch (err) {
        console.error("Error fetching /number:", err);
        setApiTextBoxValue("error");
      }
    })();
  }, []);

  // Called when slider finishes changing (Plasmic will call this via the interaction prop)
  async function onValueChange(newSliderValue: number) {
    try {
      console.log("Slider event - newSliderValue:", newSliderValue);

      // Update local slider UI state immediately
      setSliderValueTs(newSliderValue);

      // Send to backend to multiply (PythonAnywhere)
      console.log("📤 About to POST to /multiply with:", { value: newSliderValue });
      const res = await fetch("https://elliotcookie.pythonanywhere.com/multiply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newSliderValue }),
      });

      console.log("Response status:", res.status);

      // Try parse json (catch if server returned HTML error etc)
      let data: unknown;
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error("Failed to parse response as JSON", parseErr);
        setMultiplyBoxValue(null);
        return;
      }

      console.log("API response data:", data);

      // If backend returns { result: <number> }, use that
      const asAny = data as { result?: number; error?: string };
      if (asAny && typeof asAny.result === "number") {
        setMultiplyBoxValue(asAny.result);
      } else if (asAny && asAny.error) {
        console.warn("Backend error:", asAny.error);
        setMultiplyBoxValue(null);
      } else {
        setMultiplyBoxValue(null);
      }
    } catch (err) {
      console.error("Error calling API:", err);
      setMultiplyBoxValue(null);
    }
  }

  // Map our local state into the prop mapping Plasmic expects.
  // Make sure the object keys exactly match the element display names and prop names in Plasmic.
  const componentProps = {
    testSlider1: {
      // Plasmic prop name is `Value` (capital V) — preserve exact spelling
      Value: sliderValueTs,
      onValueChange: onValueChange,
    },
    // If your top-level text component expects a `text` prop:
    apiTestTextBox: {
      text: apiTextBoxValue,
    },
    // multiplyBox -> prop name in Plasmic is valueMb (or what you set); make exact match:
    multiplyBox: {
      valueMb: multiplyBoxValue ?? 0,
    },
  };

  // Optional debug log that will appear in the browser console (production will also show console logs).
  console.debug("componentProps about to send TO PLASMIC:", componentProps);

  return (
    <PlasmicRootProvider
      loader={PLASMIC}
      prefetchedData={plasmicData}
      prefetchedQueryData={queryCache}
      pageRoute={pageMeta.path}
      pageParams={pageMeta.params}
      pageQuery={router.query}
    >
      <PlasmicComponent component={pageMeta.displayName} componentProps={componentProps} />
    </PlasmicRootProvider>
  );
}

/**
 * Leave getStaticProps/getStaticPaths as provided by Plasmic. If you have local copies/migrations,
 * ensure they still exist in this file (we did not modify those here).
 *
 * If you removed the generated getStaticProps/getStaticPaths earlier, restore them from your repo.
 */
export const getStaticProps: GetStaticProps = async (context) => {
  const { catchall } = context.params ?? {};
  const plasmicPath =
    typeof catchall === "string" ? catchall : Array.isArray(catchall) ? `/${catchall.join("/")}` : "/";
  const plasmicData = await PLASMIC.maybeFetchComponentData(plasmicPath);
  if (!plasmicData) {
    return { props: {} };
  }
  const pageMeta = plasmicData.entryCompMetas[0];
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
