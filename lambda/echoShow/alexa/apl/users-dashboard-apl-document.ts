//apl/users-dashboard-apl-document.ts
import { sharedResources } from "./shared-apl-components";

export const usersDashboardDocument = {
  type: "APL",
  version: "2024.2",
  import: [
    {
      name: "alexa-layouts",
      version: "1.7.0"
    }
  ],
  resources: [
    {
      colors: {
        ...sharedResources.colors
      },
      dimensions: {
        ...sharedResources.dimensions,
        textXl: "42dp",
        text3xl: "96dp"
      }
    }
  ],
  mainTemplate: {
    parameters: ["data"],
    items: [
      {
        type: "Container",
        width: "100vw",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "@background",
        items: [
          {
            type: "Text",
            text: "${data.title}",
            fontSize: "@textXl",
            fontWeight: "700",
            color: "@textPrimary"
          },
          {
            type: "Text",
            text: "${data.value}",
            fontSize: "@text3xl",
            fontWeight: "700",
            color: "@accentOrange"
          },
          {
            type: "Text",
            text: "${data.message}",
            fontSize: "@textLg",
            color: "@textSecondary"
          }
        ]
      }
    ]
  }
};
