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

export default function PlasmicLoaderPage(props: {
  plasmicData?: ComponentRenderData;
  queryCache?: Record<string, unknown>;
}) {
  const { plasmicData, queryCache } = props;
  const router = useRouter();

  // === State variables ===
  const [sliderValueTs, setSliderValueTs] = React.useState(0);

  // For apiTestTextBox
  const [testStateTextVariable, setTestStateTextVariable] = React.useState<string>("loading...");

  // For multiplyBox
  //const [multiplyBoxValue, setMultiplyBoxValue] = React.useState<number>(0);

  // For the slider value returned from PA
  const [returnedMultiplePa, setReturnedMultiplePa] = React.useState<number | null>(null);

  // === Component props mapping ===
  /* const componentProps = {
    testSlider1: {
      Value: sliderValueTs,
      onValueChange: onValueChange,
    },
    apiTestTextBox: {            
      text: testStateTextVariable, 
    },
    multiplyBox: {            
      valueMb: multiplyBoxValue, // match your $props.valueMb in Plasmic
    },
  }; */

//console.log("componentProps about to send TO PLASMIC:", componentProps);
//console.log("componentProps about to send TO PLASMIC:", JSON.stringify(componentProps));

  React.useEffect(() => {
    fetch("https://elliotcookie.pythonanywhere.com/number")
      .then((res) => res.json())
      .then((data) => {
      console.log("API fetch /number result:", data);
        if (data && data.result !== undefined) {
          setTestStateTextVariable(String(data.result)); // ensure string
        }
      })
      .catch(console.error);
  }, []);

  async function onValueChange(newSliderValue: number) {
  console.log("🔄 Slider changed to:", newSliderValue);
  setSliderValueTs(newSliderValue);

  try {
    console.log("📤 About to POST to /multiply with:", { value: newSliderValue });
    
    const res = await fetch("https://elliotcookie.pythonanywhere.com/multiply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: newSliderValue }), // send slider value to PA
    });

    console.log("📥 Response status:", res.status);
    const json = await res.json();
    console.log("✅ Response JSON from PA:", json);

    // Store returned multiplied value from PA
    if (typeof json.result === "number") {
      setReturnedMultiplePa(json.result);
    } else {
      console.warn("⚠️ API returned unexpected format:", json);
    }

  } catch (err) {
    console.error("❌ Error calling API:", err);
  }
}

  if (!plasmicData || plasmicData.entryCompMetas.length === 0) {
    return <Error statusCode={404} />;
  }
  const pageMeta = plasmicData.entryCompMetas[0];

  return (
    <PlasmicRootProvider
      loader={PLASMIC}
      prefetchedData={plasmicData}
      prefetchedQueryData={queryCache}
      pageRoute={pageMeta.path}
      pageParams={pageMeta.params}
      pageQuery={router.query}
    >
      <PlasmicComponent
      component={pageMeta.displayName}
      componentProps={{
        testSlider1: {
          Value: sliderValueTs, // TS slider value → slider component
          onValueChange: onValueChange,
        },
        apiTestTextBox: {
          testStateTextVariable: sliderValueTs, // If you still want slider value here
        },
        multiplyBox: {
          valueMb: returnedMultiplePa ?? "Waiting...", 
          // The multiplied value from PA → multiplyBox
        },
      }}
      />
    </PlasmicRootProvider>
  );
}


export const getStaticPaths: GetStaticPaths = async () => {
  // You can preload the paths you want to support here or fallback to blocking
  return {
    paths: [], // empty, all pages generated on-demand
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { catchall } = context.params ?? {};
  const plasmicPath =
    typeof catchall === "string"
      ? "/" + catchall
      : Array.isArray(catchall)
      ? "/" + catchall.join("/")
      : "/";

  console.log("Plasmic path requested:", plasmicPath);

  const plasmicData = await PLASMIC.maybeFetchComponentData(plasmicPath);

  console.log("Plasmic data fetched:", plasmicData ? "FOUND" : "NOT FOUND");

  if (!plasmicData) {
    return { notFound: true };
  }

  // Await this!
  const queryCache = await extractPlasmicQueryData(plasmicData as any);

  return {
    props: {
      plasmicData,
      queryCache,
    },
    revalidate: 10,
  };
};

