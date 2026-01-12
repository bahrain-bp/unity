import { sharedResources, buildFooterHint, buildHeader } from "./shared-apl-components";

export const usersHourlyStatsDocument = {
  type: "APL",
  version: "2024.2",
  import: [
    {
      name: "alexa-layouts",
      version: "1.7.0",
      background: "#ebebeb",

    }
  ],
  resources: [
    {
      colors: {
        ...sharedResources.colors,
        background: "#ebebeb",
        accentOrange: "#FF8E3C",
        accentBlue: "#3B82F6",
        accentPurple: "#8B5CF6"
      },
      dimensions: {
        ...sharedResources.dimensions,
        borderRadius: "24dp",
        textXl: "40dp",
        text2xl: "52dp",
        text3xl: "72dp"
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
                title: "Hourly Website Activity",
                subtitle: "Today's website traffic",
                showTime: true,
                spacing: "20dp",
                marginBottom: "50dp"
              }),

              /* 3 METRIC CARDS */
              {
                type: "Container",
                width: "100%",
                height: "0",
                grow: 1,
                when: "${data.hasActivity}",
                alignItems: "center",
                justifyContent: "center",
                items: [
                  {
                    type: "Container",
                    width: "100%",
                    maxWidth: "1100dp",
                    direction: "row",
                    justifyContent: "center",
                    spacing: "24dp",
                    items: [

                      /* PEAK CARD */
                      {
                        type: "Container",
                        width: "0",
                        grow: 1,
                        items: [
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
                          {
                            type: "Frame",
                            width: "100%",
                            backgroundColor: "@cardLight",
                            borderRadius: "@borderRadius",
                            borderWidth: "3dp",
                            borderColor: "@accentOrange",
                            items: [
                              {
                                type: "Container",
                                width: "100%",
                                paddingLeft: "32dp",
                                paddingRight: "32dp",
                                paddingTop: "40dp",
                                paddingBottom: "40dp",
                                alignItems: "center",
                                items: [
                                  {
                                    type: "Text",
                                    text: "Peak",
                                    fontSize: "40dp",
                                    marginBottom: "16dp"
                                  },
                                  {
                                    type: "Text",
                                    text: "Peak Time",
                                    fontSize: "@textBase",
                                    fontWeight: "600",
                                    color: "@textSecondary",
                                    textAlign: "center",
                                    marginBottom: "12dp"
                                  },
                                  {
                                    type: "Text",
                                    text: "${data.peak.label}",
                                    fontSize: "@text3xl",
                                    fontWeight: "700",
                                    color: "@accentOrange",
                                    textAlign: "center",
                                    letterSpacing: "-1dp",
                                    marginBottom: "8dp"
                                  },
                                  {
                                    type: "Text",
                                    text: "${data.peak.users} users",
                                    fontSize: "@textLg",
                                    fontWeight: "400",
                                    color: "@textSecondary",
                                    textAlign: "center"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },

                      /* MID CARD */
                      {
                        type: "Container",
                        width: "0",
                        grow: 1,
                        items: [
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
                          {
                            type: "Frame",
                            width: "100%",
                            backgroundColor: "@cardLight",
                            borderRadius: "@borderRadius",
                            borderWidth: "3dp",
                            borderColor: "@accentBlue",
                            items: [
                              {
                                type: "Container",
                                width: "100%",
                                paddingLeft: "32dp",
                                paddingRight: "32dp",
                                paddingTop: "40dp",
                                paddingBottom: "40dp",
                                alignItems: "center",
                                items: [
                                  {
                                    type: "Text",
                                    text: "Avg",
                                    fontSize: "40dp",
                                    marginBottom: "16dp"
                                  },
                                  {
                                    type: "Text",
                                    text: "Average",
                                    fontSize: "@textBase",
                                    fontWeight: "600",
                                    color: "@textSecondary",
                                    textAlign: "center",
                                    marginBottom: "12dp"
                                  },
                                  {
                                    type: "Text",
                                    text: "${data.mid.label}",
                                    fontSize: "@text3xl",
                                    fontWeight: "700",
                                    color: "@accentBlue",
                                    textAlign: "center",
                                    letterSpacing: "-1dp",
                                    marginBottom: "8dp"
                                  },
                                  {
                                    type: "Text",
                                    text: "${data.mid.users} users",
                                    fontSize: "@textLg",
                                    fontWeight: "400",
                                    color: "@textSecondary",
                                    textAlign: "center"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },

                      /* LOWEST CARD */
                      {
                        type: "Container",
                        width: "0",
                        grow: 1,
                        items: [
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
                                paddingLeft: "32dp",
                                paddingRight: "32dp",
                                paddingTop: "40dp",
                                paddingBottom: "40dp",
                                alignItems: "center",
                                items: [
                                  {
                                    type: "Text",
                                    text: "Low",
                                    fontSize: "40dp",
                                    marginBottom: "16dp"
                                  },
                                  {
                                    type: "Text",
                                    text: "Quietest Time",
                                    fontSize: "@textBase",
                                    fontWeight: "600",
                                    color: "@textSecondary",
                                    textAlign: "center",
                                    marginBottom: "12dp"
                                  },
                                  {
                                    type: "Text",
                                    text: "${data.lowest.label}",
                                    fontSize: "@text3xl",
                                    fontWeight: "700",
                                    color: "@accentPurple",
                                    textAlign: "center",
                                    letterSpacing: "-1dp",
                                    marginBottom: "8dp"
                                  },
                                  {
                                    type: "Text",
                                    text: "${data.lowest.users} users",
                                    fontSize: "@textLg",
                                    fontWeight: "400",
                                    color: "@textSecondary",
                                    textAlign: "center"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                type: "Container",
                width: "100%",
                height: "0",
                grow: 1,
                when: "${!data.hasActivity}",
                alignItems: "center",
                justifyContent: "center",
                items: [
                  {
                    type: "Text",
                    text: "No activity recorded today",
                    fontSize: "@textLg",
                    fontWeight: "600",
                    color: "@textSecondary",
                    textAlign: "center"
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
