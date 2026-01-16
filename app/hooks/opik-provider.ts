// app/hooks/opik-provider.ts
export const OpikTracer = {
  logAgentAction: async (name: string, input: any, output: any, tags: string[]) => {
    try {
      const response = await fetch("/api/opik", {
        method: "POST", // This must match the 'action' function
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          input,
          output,
          tags,
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
        }),
      });
      
      if (response.ok) {
        console.log("✅ Opik Trace success");
      }
    } catch (error) {
      console.error("Opik fetch failed:", error);
    }
  }
};