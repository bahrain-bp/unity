import { sharedResources, buildFooterHint, buildHeader } from "./shared-apl-components";

export const dashboardDocument = {
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
        ...sharedResources.colors
      },
      dimensions: {
        ...sharedResources.dimensions,
        borderRadius: "24dp",
        textXl: "40dp",
        text2xl: "52dp",
        text3xl: "108dp"
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
                title: "${data.title}",
                subtitle: "${data.description}",
                showTime: true,
                spacing: "20dp",
                marginBottom: "50dp"
              }),

              /* METRIC CARD - CLEAN & SPACIOUS */
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
                    maxWidth: "850dp",
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
                        borderColor: "${data.accentColor}",
                        items: [
                          {
                            type: "Container",
                            width: "100%",
                            paddingLeft: "70dp",
                            paddingRight: "70dp",
                            paddingTop: "80dp",
                            paddingBottom: "80dp",
                            alignItems: "center",
                            items: [
                              /* VALUE */
                              {
                                when: "${data.showValue}",
                                type: "Text",
                                text: "${data.value}",
                                fontSize: "@text3xl",
                                fontWeight: "700",
                                color: "${data.accentColor}",
                                letterSpacing: "-2dp",
                                marginBottom: "32dp"
                              },
                              /* MESSAGE */
                              {
                                type: "Text",
                                text: "${data.message}",
                                fontSize: "@textLg",
                                fontWeight: "400",
                                color: "@textSecondary",
                                textAlign: "center",
                                maxLines: 2
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },

              buildFooterHint("@textBase")
            ]
          }
        ]
      }
    ]
  },

  graphics: sharedResources.graphics
};

