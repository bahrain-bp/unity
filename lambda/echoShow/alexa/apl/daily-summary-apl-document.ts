import { sharedResources, buildFooterHint, buildHeader } from "./shared-apl-components";

export const dailySummaryDocument = {
  type: "APL",
  version: "2024.2",
  background: "#ebebeb",

  import: [
    {
      name: "alexa-layouts",
      version: "1.7.0"
    }
  ],
  resources: [
    {
      colors: {
        ...sharedResources.colors,
        accentPurple: "#8B5CF6"
      },
      dimensions: {
        ...sharedResources.dimensions,
        borderRadius: "20dp",
        spacing: "22dp",
        textXl: "42dp",
        text2xl: "56dp"
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
        backgroundColor: "@background",
        items: [
          /* MAIN CONTENT */
          {
            type: "Container",
            width: "100%",
            height: "100%",
            paddingLeft: "70dp",
            paddingRight: "70dp",
            paddingTop: "60dp",
            paddingBottom: "60dp",
            items: [
              buildHeader({
                title: "Daily Summary",
                subtitle: "Summary for ${data.summaryDateLabel}",
                showDate: true,
                dateBinding: "${data.date}",
                spacing: "@spacing",
                marginBottom: "48dp"
              }),

              /* SUMMARY CARD */
              {
                type: "Container",
                width: "100%",
                height: "0",
                grow: 1,
                alignItems: "center",
                justifyContent: "center",
                items: [
                  {
                    type: "Container",
                    maxWidth: "1000dp",
                    items: [
                      /* SHADOW */
                      {
                        type: "Frame",
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        backgroundColor: "@shadowDark",
                        borderRadius: "@borderRadius",
                        left: "@shadowOffset",
                        top: "@shadowOffset"
                      },
                      /* CARD */
                      {
                        type: "Frame",
                        width: "100%",
                        backgroundColor: "@cardLight",
                        borderRadius: "@borderRadius",
                        borderWidth: "3dp",
                        borderColor: "@accentPurple",
                        items: [
                          {
                            type: "Container",
                            width: "100%",
                            padding: "60dp",
                            items: [
                              /* AI BADGE */
                              {
                                type: "Container",
                                direction: "row",
                                alignItems: "center",
                                spacing: "12dp",
                                marginBottom: "32dp",
                                items: [
                                  {
                                    type: "Text",
                                    text: "AI",
                                    fontSize: "28dp",
                                    fontWeight: "700",
                                    color: "@accentPurple"
                                  },
                                  {
                                    type: "Text",
                                    text: "Analysis",
                                    fontSize: "24dp",
                                    fontWeight: "700",
                                    color: "@accentPurple"
                                  }
                                ]
                              },
                              /* SUMMARY TEXT */
                              {
                                type: "Text",
                                text: "${data.summary}",
                                fontSize: "@textLg",
                                color: "@textPrimary",
                                textAlign: "left",
                                lineHeight: "1.6"
                              },
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },

              buildFooterHint("@textSm")
            ]
          }
        ]
      }
    ]
  },

  graphics: sharedResources.graphics
};
