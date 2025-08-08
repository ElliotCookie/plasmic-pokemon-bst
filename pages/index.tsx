import React, { useState } from "react";
import { PlasmicComponent } from "@plasmicapp/loader-nextjs";
import { PLASMIC } from "@/plasmic-init";

export default function HomePage() {
  const [result, setResult] = useState<number | null>(null);

  async function handleValueChange(value: number) {
    try {
      const response = await fetch("https://elliotcookie.pythonanywhere.com/multiply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult(data.result);
      } else {
        setResult(null);
        console.error(data.error);
      }
    } catch (error) {
      setResult(null);
      console.error("Fetch error:", error);
    }
  }

  return (
    <PlasmicComponent
      component="Slider"
      onValueChange={handleValueChange}
      result={result} // Pass the result as a prop if your text box is a Plasmic component prop
    />
  );
}