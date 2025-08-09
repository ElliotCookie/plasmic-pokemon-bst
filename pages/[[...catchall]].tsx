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

  const [sliderValue, setSliderValue] = React.useState(0);
  //const [apiResult, setApiResult] = React.useState<string | number>("");
  //const [testStateTextVariable, setTestStateTextVariable] = React.useState<string>("");
  const [testStateTextVariable, setTestStateTextVariable] = React.useState<string>("loading...");
/*   const debugMapping = {
    //["apiTestTextBox"]: {
      ["TestStateTextVariable"]: testStateTextVariable,
    //}
  };
  console.log("componentProps about to send:", debugMapping); */

  const componentProps = {
  // keep the slider mapping (if you want the slider still connected)
  testSlider1: {
    Value: sliderValue,
    onValueChange: onValueChange,
  },

  // IMPORTANT: replace 'apiElementName' and 'propNameHere' with the exact strings FROM PLASMIC
  apiTestTextBox: {            // <-- e.g. apiTestTextBox  (element name from Plasmic)
    text: testStateTextVariable, // <-- e.g. testStateTextVariable (prop name exactly)
  },
};

console.log("componentProps about to send TO PLASMIC:", componentProps);
console.log("componentProps about to send TO PLASMIC:", JSON.stringify(componentProps));




  // <-- Add this useEffect to fetch the initial number once on mount
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

  async function onValueChange(value: number) {
    console.log("About to POST to /multiply:", { value: sliderValue });
    const res = await fetch("https://elliotcookie.pythonanywhere.com/multiply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: sliderValue })
    });
    console.log("Response status:", res.status);
    const json = await res.json();
    console.log("Response JSON:", json);

    console.log("Slider changed to:", value);
    setSliderValue(value);

    // Send value to Flask backend
    fetch("https://elliotcookie.pythonanywhere.com/multiply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }), // send the slider number
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("API response:", data);
        //if (data.result !== undefined) {
        // setApiResult(String(data.result)); // update the text box with backend result
        //}
      })
      .catch((err) => {
        console.error("Error calling API:", err);
      });
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
        componentProps={componentProps}
        //componentProps={debugMapping}
        //componentProps={{


          //testSlider1: {
           // Value: sliderValue,
           // onValueChange: onValueChange,
          //},



          // Update the text box component. Use the exact Plasmic displayName for that
          // child component (replace `textBox1` below if your component has a different name).
          
            //TestStateTextVariable: testStateTextVariable,
           



        //}}
      />
    </PlasmicRootProvider>
  );
}


// Add these getStaticPaths and getStaticProps:

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

