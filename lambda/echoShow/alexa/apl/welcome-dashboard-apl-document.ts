import { sharedResources } from "./shared-apl-components";

export const welcomeDashboardDocument = {
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
        buttonRadius: "48dp",
        buttonHeight: "96dp",
        buttonWidth: "520dp",
        buttonSpacing: "18dp",
        textLg: "26dp",
        textXl: "38dp",
        text2xl: "52dp"
      }
    }
  ],

  mainTemplate: {
    parameters: ["payload"],
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
            paddingTop: "50dp",
            paddingBottom: "50dp",
            justifyContent: "spaceBetween",
            items: [
              /* HEADER */
              {
                type: "Container",
                width: "100%",
                alignItems: "center",
                items: [
                  {
                    type: "Text",
                    text: "BahTwin Admin Dashboard",
                    fontSize: "@text2xl",
                    fontWeight: "700",
                    color: "@textPrimary",
                    textAlign: "center",
                    letterSpacing: "-0.5dp"
                  },
                  {
                    type: "Text",
                    text: "Hi admin! I'm Peccy, your assistant",
                    fontSize: "@textLg",
                    fontWeight: "400",
                    color: "@textSecondary",
                    textAlign: "center",
                    paddingTop: "12dp"
                  }
                ]
              },

              /* BUTTONS GRID */
              {
                type: "ScrollView",
                width: "100%",
                height: "0",
                grow: 1,
                items: [
                  {
                    type: "Container",
                    width: "100%",
                    alignItems: "center",
                    items: [
                      {
                        type: "Container",
                        width: "100%",
                        maxWidth: "1120dp",
                        direction: "column",
                        spacing: "@buttonSpacing",
                        items: [
                                                    /* ROW 1: 3 PILLS */
                          {
                            type: "Container",
                            width: "100%",
                            direction: "row",
                            spacing: "@buttonSpacing",
                            items: [
                              {
                                type: "TouchWrapper",
                                width: "0",
                                grow: 1,
                                height: "@buttonHeight",
                                onPress: [
                                  {
                                    type: "SendEvent",
                                    arguments: ["ShowAllDashboardIntent"]
                                  }
                                ],
                                item: {
                                  type: "Container",
                                  items: [
                                    {
                                      type: "Frame",
                                      position: "absolute",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@shadowDark",
                                      borderRadius: "@buttonRadius",
                                      left: "@shadowOffset",
                                      top: "@shadowOffset"
                                    },
                                    {
                                      type: "Frame",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@cardLight",
                                      borderRadius: "@buttonRadius",
                                      borderWidth: "3dp",
                                      borderColor: "@accentBlue",
                                      items: [
                                        {
                                          type: "Container",
                                          width: "100%",
                                          height: "100%",
                                          justifyContent: "center",
                                          alignItems: "center",
                                          paddingLeft: "24dp",
                                          paddingRight: "24dp",
                                          items: [
                                            {
                                              type: "Text",
                                              text: "All-in-One Dashboard",
                                              fontSize: "@textLg",
                                              fontWeight: "700",
                                              color: "@textPrimary",
                                              textAlign: "center",
                                              letterSpacing: "-0.3dp"
                                            },
                                            {
                                              type: "Text",
                                              text: "Full system overview",
                                              fontSize: "@textBase",
                                              fontWeight: "400",
                                              color: "@textSecondary",
                                              textAlign: "center",
                                              paddingTop: "6dp"
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              {
                                type: "TouchWrapper",
                                width: "0",
                                grow: 1,
                                height: "@buttonHeight",
                                onPress: [
                                  {
                                    type: "SendEvent",
                                    arguments: ["GetActivePlayersIntent"]
                                  }
                                ],
                                item: {
                                  type: "Container",
                                  items: [
                                    {
                                      type: "Frame",
                                      position: "absolute",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@shadowDark",
                                      borderRadius: "@buttonRadius",
                                      left: "@shadowOffset",
                                      top: "@shadowOffset"
                                    },
                                    {
                                      type: "Frame",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@cardLight",
                                      borderRadius: "@buttonRadius",
                                      borderWidth: "3dp",
                                      borderColor: "@accentOrange",
                                      items: [
                                        {
                                          type: "Container",
                                          width: "100%",
                                          height: "100%",
                                          justifyContent: "center",
                                          alignItems: "center",
                                          paddingLeft: "24dp",
                                          paddingRight: "24dp",
                                          items: [
                                            {
                                              type: "Text",
                                              text: "Active Players",
                                              fontSize: "@textLg",
                                              fontWeight: "700",
                                              color: "@textPrimary",
                                              textAlign: "center",
                                              letterSpacing: "-0.3dp"
                                            },
                                            {
                                              type: "Text",
                                              text: "In the office now",
                                              fontSize: "@textBase",
                                              fontWeight: "400",
                                              color: "@textSecondary",
                                              textAlign: "center",
                                              paddingTop: "6dp"
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              {
                                type: "TouchWrapper",
                                width: "0",
                                grow: 1,
                                height: "@buttonHeight",
                                onPress: [
                                  {
                                    type: "SendEvent",
                                    arguments: ["GetActiveUsersNowIntent"]
                                  }
                                ],
                                item: {
                                  type: "Container",
                                  items: [
                                    {
                                      type: "Frame",
                                      position: "absolute",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@shadowDark",
                                      borderRadius: "@buttonRadius",
                                      left: "@shadowOffset",
                                      top: "@shadowOffset"
                                    },
                                    {
                                      type: "Frame",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@cardLight",
                                      borderRadius: "@buttonRadius",
                                      borderWidth: "3dp",
                                      borderColor: "@accentPurple",
                                      items: [
                                        {
                                          type: "Container",
                                          width: "100%",
                                          height: "100%",
                                          justifyContent: "center",
                                          alignItems: "center",
                                          paddingLeft: "24dp",
                                          paddingRight: "24dp",
                                          items: [
                                            {
                                              type: "Text",
                                              text: "Website Users",
                                              fontSize: "@textLg",
                                              fontWeight: "700",
                                              color: "@textPrimary",
                                              textAlign: "center",
                                              letterSpacing: "-0.3dp"
                                            },
                                            {
                                              type: "Text",
                                              text: "Live activity",
                                              fontSize: "@textBase",
                                              fontWeight: "400",
                                              color: "@textSecondary",
                                              textAlign: "center",
                                              paddingTop: "6dp"
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            ]
                          },

                          /* ROW 2: 2 PILLS (SUMMARY SPANS 2) */
                          {
                            type: "Container",
                            width: "100%",
                            direction: "row",
                            spacing: "@buttonSpacing",
                            items: [
                              {
                                type: "TouchWrapper",
                                width: "0",
                                grow: 2,
                                height: "@buttonHeight",
                                onPress: [
                                  {
                                    type: "SendEvent",
                                    arguments: ["GetDailySummaryIntent"]
                                  }
                                ],
                                item: {
                                  type: "Container",
                                  items: [
                                    {
                                      type: "Frame",
                                      position: "absolute",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@shadowDark",
                                      borderRadius: "@buttonRadius",
                                      left: "@shadowOffset",
                                      top: "@shadowOffset"
                                    },
                                    {
                                      type: "Frame",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@cardLight",
                                      borderRadius: "@buttonRadius",
                                      borderWidth: "3dp",
                                      borderColor: "@accentPurple",
                                      items: [
                                        {
                                          type: "Container",
                                          width: "100%",
                                          height: "100%",
                                          justifyContent: "center",
                                          alignItems: "center",
                                          paddingLeft: "24dp",
                                          paddingRight: "24dp",
                                          items: [
                                            {
                                              type: "Text",
                                              text: "AI Daily Brief",
                                              fontSize: "@textLg",
                                              fontWeight: "700",
                                              color: "@textPrimary",
                                              textAlign: "center",
                                              letterSpacing: "-0.3dp"
                                            },
                                            {
                                              type: "Text",
                                              text: "Today’s highlights in seconds",
                                              fontSize: "@textBase",
                                              fontWeight: "400",
                                              color: "@textSecondary",
                                              textAlign: "center",
                                              paddingTop: "6dp"
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              {
                                type: "TouchWrapper",
                                width: "0",
                                grow: 1,
                                height: "@buttonHeight",
                                onPress: [
                                  {
                                    type: "SendEvent",
                                    arguments: ["GetUsersTodayHourlyIntent"]
                                  }
                                ],
                                item: {
                                  type: "Container",
                                  items: [
                                    {
                                      type: "Frame",
                                      position: "absolute",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@shadowDark",
                                      borderRadius: "@buttonRadius",
                                      left: "@shadowOffset",
                                      top: "@shadowOffset"
                                    },
                                    {
                                      type: "Frame",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@cardLight",
                                      borderRadius: "@buttonRadius",
                                      borderWidth: "3dp",
                                      borderColor: "@accentBlue",
                                      items: [
                                        {
                                          type: "Container",
                                          width: "100%",
                                          height: "100%",
                                          justifyContent: "center",
                                          alignItems: "center",
                                          paddingLeft: "24dp",
                                          paddingRight: "24dp",
                                          items: [
                                            {
                                              type: "Text",
                                              text: "Hourly Stats",
                                              fontSize: "@textLg",
                                              fontWeight: "700",
                                              color: "@textPrimary",
                                              textAlign: "center",
                                              letterSpacing: "-0.3dp"
                                            },
                                            {
                                              type: "Text",
                                              text: "Hour by hour",
                                              fontSize: "@textBase",
                                              fontWeight: "400",
                                              color: "@textSecondary",
                                              textAlign: "center",
                                              paddingTop: "6dp"
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            ]
                          },

                          /* ROW 3: 3 PILLS */
                          {
                            type: "Container",
                            width: "100%",
                            direction: "row",
                            spacing: "@buttonSpacing",
                            items: [
                              {
                                type: "TouchWrapper",
                                width: "0",
                                grow: 1,
                                height: "@buttonHeight",
                                onPress: [
                                  {
                                    type: "SendEvent",
                                    arguments: ["GetUsersTodayIntent"]
                                  }
                                ],
                                item: {
                                  type: "Container",
                                  items: [
                                    {
                                      type: "Frame",
                                      position: "absolute",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@shadowDark",
                                      borderRadius: "@buttonRadius",
                                      left: "@shadowOffset",
                                      top: "@shadowOffset"
                                    },
                                    {
                                      type: "Frame",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@cardLight",
                                      borderRadius: "@buttonRadius",
                                      borderWidth: "3dp",
                                      borderColor: "@accentGreen",
                                      items: [
                                        {
                                          type: "Container",
                                          width: "100%",
                                          height: "100%",
                                          justifyContent: "center",
                                          alignItems: "center",
                                          paddingLeft: "24dp",
                                          paddingRight: "24dp",
                                          items: [
                                            {
                                              type: "Text",
                                              text: "Today's Activity",
                                              fontSize: "@textLg",
                                              fontWeight: "700",
                                              color: "@textPrimary",
                                              textAlign: "center",
                                              letterSpacing: "-0.3dp"
                                            },
                                            {
                                              type: "Text",
                                              text: "Total visitors",
                                              fontSize: "@textBase",
                                              fontWeight: "400",
                                              color: "@textSecondary",
                                              textAlign: "center",
                                              paddingTop: "6dp"
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              {
                                type: "TouchWrapper",
                                width: "0",
                                grow: 1,
                                height: "@buttonHeight",
                                onPress: [
                                  {
                                    type: "SendEvent",
                                    arguments: ["ShowIotSensorsIntent"]
                                  }
                                ],
                                item: {
                                  type: "Container",
                                  items: [
                                    {
                                      type: "Frame",
                                      position: "absolute",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@shadowDark",
                                      borderRadius: "@buttonRadius",
                                      left: "@shadowOffset",
                                      top: "@shadowOffset"
                                    },
                                    {
                                      type: "Frame",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@cardLight",
                                      borderRadius: "@buttonRadius",
                                      borderWidth: "3dp",
                                      borderColor: "@accentRed",
                                      items: [
                                        {
                                          type: "Container",
                                          width: "100%",
                                          height: "100%",
                                          justifyContent: "center",
                                          alignItems: "center",
                                          paddingLeft: "24dp",
                                          paddingRight: "24dp",
                                          items: [
                                            {
                                              type: "Text",
                                              text: "IoT Sensors",
                                              fontSize: "@textLg",
                                              fontWeight: "700",
                                              color: "@textPrimary",
                                              textAlign: "center",
                                              letterSpacing: "-0.3dp"
                                            },
                                            {
                                              type: "Text",
                                              text: "Environment data",
                                              fontSize: "@textBase",
                                              fontWeight: "400",
                                              color: "@textSecondary",
                                              textAlign: "center",
                                              paddingTop: "6dp"
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              {
                                type: "TouchWrapper",
                                width: "0",
                                grow: 1,
                                height: "@buttonHeight",
                                onPress: [
                                  {
                                    type: "SendEvent",
                                    arguments: ["GetMeetingRoomOccupancyIntent"]
                                  }
                                ],
                                item: {
                                  type: "Container",
                                  items: [
                                    {
                                      type: "Frame",
                                      position: "absolute",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@shadowDark",
                                      borderRadius: "@buttonRadius",
                                      left: "@shadowOffset",
                                      top: "@shadowOffset"
                                    },
                                    {
                                      type: "Frame",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@cardLight",
                                      borderRadius: "@buttonRadius",
                                      borderWidth: "3dp",
                                      borderColor: "@accentBlue",
                                      items: [
                                        {
                                          type: "Container",
                                          width: "100%",
                                          height: "100%",
                                          justifyContent: "center",
                                          alignItems: "center",
                                          paddingLeft: "24dp",
                                          paddingRight: "24dp",
                                          items: [
                                            {
                                              type: "Text",
                                              text: "Meeting Rooms",
                                              fontSize: "@textLg",
                                              fontWeight: "700",
                                              color: "@textPrimary",
                                              textAlign: "center",
                                              letterSpacing: "-0.3dp"
                                            },
                                            {
                                              type: "Text",
                                              text: "Occupancy status",
                                              fontSize: "@textBase",
                                              fontWeight: "400",
                                              color: "@textSecondary",
                                              textAlign: "center",
                                              paddingTop: "6dp"
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            ]
                          },

                          /* ROW 4: 2 PILLS */
                          {
                            type: "Container",
                            width: "100%",
                            direction: "row",
                            spacing: "@buttonSpacing",
                            items: [
                              {
                                type: "TouchWrapper",
                                width: "0",
                                grow: 1,
                                height: "@buttonHeight",
                                onPress: [
                                  {
                                    type: "SendEvent",
                                    arguments: ["OpenAdminWebsiteIntent"]
                                  }
                                ],
                                item: {
                                  type: "Container",
                                  items: [
                                    {
                                      type: "Frame",
                                      position: "absolute",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@shadowDark",
                                      borderRadius: "@buttonRadius",
                                      left: "@shadowOffset",
                                      top: "@shadowOffset"
                                    },
                                    {
                                      type: "Frame",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@cardLight",
                                      borderRadius: "@buttonRadius",
                                      borderWidth: "3dp",
                                      borderColor: "@accentPurple",
                                      items: [
                                        {
                                          type: "Container",
                                          width: "100%",
                                          height: "100%",
                                          justifyContent: "center",
                                          alignItems: "center",
                                          paddingLeft: "24dp",
                                          paddingRight: "24dp",
                                          items: [
                                            {
                                              type: "Text",
                                              text: "Admin Website",
                                              fontSize: "@textLg",
                                              fontWeight: "700",
                                              color: "@textPrimary",
                                              textAlign: "center",
                                              letterSpacing: "-0.3dp"
                                            },
                                            {
                                              type: "Text",
                                              text: "Sign in to admin view",
                                              fontSize: "@textBase",
                                              fontWeight: "400",
                                              color: "@textSecondary",
                                              textAlign: "center",
                                              paddingTop: "6dp"
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              {
                                type: "TouchWrapper",
                                width: "0",
                                grow: 1,
                                height: "@buttonHeight",
                                onPress: [
                                  {
                                    type: "SendEvent",
                                    arguments: ["OpenWhiteboardIntent"]
                                  }
                                ],
                                item: {
                                  type: "Container",
                                  items: [
                                    {
                                      type: "Frame",
                                      position: "absolute",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@shadowDark",
                                      borderRadius: "@buttonRadius",
                                      left: "@shadowOffset",
                                      top: "@shadowOffset"
                                    },
                                    {
                                      type: "Frame",
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "@cardLight",
                                      borderRadius: "@buttonRadius",
                                      borderWidth: "3dp",
                                      borderColor: "@accentBlue",
                                      items: [
                                        {
                                          type: "Container",
                                          width: "100%",
                                          height: "100%",
                                          justifyContent: "center",
                                          alignItems: "center",
                                          paddingLeft: "24dp",
                                          paddingRight: "24dp",
                                          items: [
                                            {
                                              type: "Text",
                                              text: "Whiteboard",
                                              fontSize: "@textLg",
                                              fontWeight: "700",
                                              color: "@textPrimary",
                                              textAlign: "center",
                                              letterSpacing: "-0.3dp"
                                            },
                                            {
                                              type: "Text",
                                              text: "WebGL board",
                                              fontSize: "@textBase",
                                              fontWeight: "400",
                                              color: "@textSecondary",
                                              textAlign: "center",
                                              paddingTop: "6dp"
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },

              /* FOOTER */
              {
                type: "Container",
                width: "100%",
                alignItems: "center",
                items: [
                  {
                    type: "Container",
                    direction: "row",
                    alignItems: "center",
                    spacing: "10dp",
                    items: [
                      {
                        type: "VectorGraphic",
                        source: "micIcon",
                        width: "20dp",
                        height: "20dp",
                        scale: "best-fit"
                      },
                      {
                        type: "Text",
                        text: "Tap a button or use your voice",
                        fontSize: "@textBase",
                        fontWeight: "400",
                        color: "@textTertiary",
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

  graphics: sharedResources.graphics
};

