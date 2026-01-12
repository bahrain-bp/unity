import { sharedResources, buildFooterHint, buildHeader } from "./shared-apl-components";

export const telemetryCardDocument = {
  type: "APL",
  version: "2024.2",
  import: [{ name: "alexa-layouts", version: "1.7.0" }],

  resources: [
    {
      colors: {
        ...sharedResources.colors
      },
      dimensions: {
        ...sharedResources.dimensions,
        cardRadius: "55dp",
        textLg: "26dp",
        textXl: "38dp",
        text2xl: "52dp",
        text3xl: "68dp"
      },
    },
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
          // Main content
          {
            type: "Container",
            width: "100%",
            height: "100%",
            paddingLeft: "70dp",
            paddingRight: "70dp",
            paddingTop: "60dp",
            paddingBottom: "60dp",
            justifyContent: "spaceBetween",
            items: [
              buildHeader({
                title: "${data.title}",
                showTime: true,
                spacing: "20dp",
                marginBottom: "40dp"
              }),

              // Metric card
              {
                type: "Container",
                width: "100%",
                alignItems: "center",
                items: [
                  {
                    type: "Container",
                    items: [
                      {
                        type: "Frame",
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        backgroundColor: "@shadowDark",
                        borderRadius: "@cardRadius",
                        left: "@shadowOffset",
                        top: "@shadowOffset",
                      },
                      {
                        type: "Frame",
                        width: "750dp",
                        height: "400dp",
                        backgroundColor: "@cardLight",
                        borderRadius: "@cardRadius",
                        borderWidth: "3dp",
                        borderColor: "${data.accentColor}",
                        items: [
                          {
                            type: "Container",
                            width: "100%",
                            height: "100%",
                            justifyContent: "center",
                            alignItems: "center",
                            paddingLeft: "50dp",
                            paddingRight: "50dp",
                            items: [
                              {
                                type: "Text",
                                text: "${data.description}",
                                fontSize: "@textLg",
                                fontWeight: "500",
                                color: "@textSecondary",
                                textAlign: "center",
                                paddingBottom: "30dp",
                              },
                              {
                                type: "Text",
                                text: "${data.value}",
                                fontSize: "@text3xl",
                                fontWeight: "800",
                                color: "@textPrimary",
                                textAlign: "center",
                                letterSpacing: "-2dp",
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },

              buildFooterHint("@textBase")
            ],
          },
        ],
      },
    ],
  },

  graphics: sharedResources.graphics
};

