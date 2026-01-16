import { type ActionFunctionArgs } from "react-router";

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();

  // We manually call the REST API since the SDK is Node-only
  const response = await fetch("https://www.comet.com/opik/api/v1/traces", {
    method: "POST",
    headers: {
      "Authorization": process.env.OPIK_API_KEY || "", // Server-side variable
      "Comet-Workspace": "gathoni",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: body.name,
      input: body.input,
      output: body.output,
      project_name: "builder-uptime"
    }),
  });

  return new Response(JSON.stringify(await response.json()), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}