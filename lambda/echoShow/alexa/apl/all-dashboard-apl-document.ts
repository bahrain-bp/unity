import { sharedResources, buildFooterHint, buildHeader } from "./shared-apl-components";

export const allDashboardDocument = {
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
        accentTeal: "#14B8A6"
      },
      dimensions: {
        ...sharedResources.dimensions,
        cardRadius: "20dp",
        spacing: "20dp",
        textXl: "38dp",
        text2xl: "50dp"
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
          {
            type: "Container",
            width: "100%",
            height: "100%",
            paddingLeft: "60dp",
            paddingRight: "60dp",
            paddingTop: "50dp",
            paddingBottom: "50dp",
            items: [
              buildHeader({
                title: "All-in-One Dashboard",
                subtitle: "Full system overview",
                showDate: true,
                showTime: true,
                dateBinding: "${data.date}",
                spacing: "@spacing",
                marginBottom: "32dp"
              }),

              {
                type: "ScrollView",
                width: "100%",
                height: "0",
                grow: 1,
                items: [
                  {
                    type: "Container",
                    width: "100%",
                    direction: "column",
                    spacing: "24dp",
                    items: [
                      {
                        type: "Container",
                        width: "100%",
                        items: [
                          {
                            type: "Frame",
                            position: "absolute",
                            width: "100%",
                            height: "100%",
                            backgroundColor: "@shadowDark",
                            borderRadius: "@cardRadius",
                            left: "@shadowOffset",
                            top: "@shadowOffset"
                          },
                          {
                            type: "Frame",
                            width: "100%",
                            backgroundColor: "@cardLight",
                            borderRadius: "@cardRadius",
                            borderWidth: "3dp",
                            borderColor: "@accentPurple",
                            items: [
                              {
                                type: "Container",
                                width: "100%",
                                padding: "32dp",
                                items: [
                                  {
                                    type: "Text",
                                    text: "Daily Summary",
                                    fontSize: "@textLg",
                                    fontWeight: "700",
                                    color: "@textPrimary",
                                    marginBottom: "12dp"
                                  },
                                  {
                                    type: "Text",
                                    text: "${data.summaryText}",
                                    fontSize: "@textBase",
                                    color: "@textSecondary",
                                    maxLines: 6
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
                        direction: "row",
                        spacing: "20dp",
                        items: [
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
                                borderRadius: "@cardRadius",
                                left: "@shadowOffset",
                                top: "@shadowOffset"
                              },
                              {
                                type: "Frame",
                                width: "100%",
                                backgroundColor: "@cardLight",
                                borderRadius: "@cardRadius",
                                borderWidth: "3dp",
                                borderColor: "@accentOrange",
                                items: [
                                  {
                                    type: "Container",
                                    padding: "22dp",
                                    items: [
                                      {
                                        type: "Text",
                                        text: "Active Players",
                                        fontSize: "@textBase",
                                        fontWeight: "700",
                                        color: "@textPrimary"
                                      },
                                      {
                                        type: "Text",
                                        text: "${data.metrics.activePlayers}",
                                        fontSize: "@text2xl",
                                        fontWeight: "700",
                                        color: "@accentOrange"
                                      }
                                    ]
                                  }
                                ]
                              }
                            ]
                          },
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
                                borderRadius: "@cardRadius",
                                left: "@shadowOffset",
                                top: "@shadowOffset"
                              },
                              {
                                type: "Frame",
                                width: "100%",
                                backgroundColor: "@cardLight",
                                borderRadius: "@cardRadius",
                                borderWidth: "3dp",
                                borderColor: "@accentPurple",
                                items: [
                                  {
                                    type: "Container",
                                    padding: "22dp",
                                    items: [
                                      {
                                        type: "Text",
                                        text: "Active Users Now",
                                        fontSize: "@textBase",
                                        fontWeight: "700",
                                        color: "@textPrimary"
                                      },
                                      {
                                        type: "Text",
                                        text: "${data.metrics.activeUsersNow}",
                                        fontSize: "@text2xl",
                                        fontWeight: "700",
                                        color: "@accentPurple"
                                      }
                                    ]
                                  }
                                ]
                              }
                            ]
                          },
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
                                borderRadius: "@cardRadius",
                                left: "@shadowOffset",
                                top: "@shadowOffset"
                              },
                              {
                                type: "Frame",
                                width: "100%",
                                backgroundColor: "@cardLight",
                                borderRadius: "@cardRadius",
                                borderWidth: "3dp",
                                borderColor: "@accentGreen",
                                items: [
                                  {
                                    type: "Container",
                                    padding: "22dp",
                                    items: [
                                      {
                                        type: "Text",
                                        text: "Users Today",
                                        fontSize: "@textBase",
                                        fontWeight: "700",
                                        color: "@textPrimary"
                                      },
                                      {
                                        type: "Text",
                                        text: "${data.metrics.usersToday}",
                                        fontSize: "@text2xl",
                                        fontWeight: "700",
                                        color: "@accentGreen"
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
                        direction: "row",
                        spacing: "20dp",
                        items: [
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
                                borderRadius: "@cardRadius",
                                left: "@shadowOffset",
                                top: "@shadowOffset"
                              },
                              {
                                type: "Frame",
                                width: "100%",
                                backgroundColor: "@cardLight",
                                borderRadius: "@cardRadius",
                                borderWidth: "3dp",
                                borderColor: "@accentRed",
                                items: [
                                  {
                                    type: "Container",
                                    padding: "22dp",
                                    items: [
                                      {
                                        type: "Text",
                                        text: "Temperature",
                                        fontSize: "@textBase",
                                        fontWeight: "700",
                                        color: "@textPrimary"
                                      },
                                      {
                                        type: "Text",
                                        text: "${data.telemetry.temperature}",
                                        fontSize: "@textXl",
                                        fontWeight: "700",
                                        color: "${data.telemetry.temperatureColor}"
                                      }
                                    ]
                                  }
                                ]
                              }
                            ]
                          },
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
                                borderRadius: "@cardRadius",
                                left: "@shadowOffset",
                                top: "@shadowOffset"
                              },
                              {
                                type: "Frame",
                                width: "100%",
                                backgroundColor: "@cardLight",
                                borderRadius: "@cardRadius",
                                borderWidth: "3dp",
                                borderColor: "@accentBlue",
                                items: [
                                  {
                                    type: "Container",
                                    padding: "22dp",
                                    items: [
                                      {
                                        type: "Text",
                                        text: "Humidity",
                                        fontSize: "@textBase",
                                        fontWeight: "700",
                                        color: "@textPrimary"
                                      },
                                      {
                                        type: "Text",
                                        text: "${data.telemetry.humidity}",
                                        fontSize: "@textXl",
                                        fontWeight: "700",
                                        color: "${data.telemetry.humidityColor}"
                                      }
                                    ]
                                  }
                                ]
                              }
                            ]
                          },
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
                                borderRadius: "@cardRadius",
                                left: "@shadowOffset",
                                top: "@shadowOffset"
                              },
                              {
                                type: "Frame",
                                width: "100%",
                                backgroundColor: "@cardLight",
                                borderRadius: "@cardRadius",
                                borderWidth: "3dp",
                                borderColor: "@accentTeal",
                                items: [
                                  {
                                    type: "Container",
                                    padding: "22dp",
                                    items: [
                                      {
                                        type: "Text",
                                        text: "Parking",
                                        fontSize: "@textBase",
                                        fontWeight: "700",
                                        color: "@textPrimary"
                                      },
                                      {
                                        type: "Text",
                                        text: "Available ${data.telemetry.parking}",
                                        fontSize: "@textSm",
                                        color: "@textSecondary",
                                        marginTop: "6dp"
                                      },
                                      {
                                        when: "${data.telemetry.hasParkingSlots}",
                                        type: "GridSequence",
                                        width: "100%",
                                        columns: 5,
                                        spacing: "8dp",
                                        data: "${data.telemetry.parkingSlots}",
                                        items: [
                                          {
                                            type: "Frame",
                                            width: "54dp",
                                            height: "54dp",
                                            backgroundColor: "${data.statusColor}",
                                            borderRadius: "10dp",
                                            borderWidth: "2dp",
                                            borderColor: "@cardLight",
                                            items: [
                                              {
                                                type: "Text",
                                                text: "${data.slotNumber}",
                                                fontSize: "@textSm",
                                                fontWeight: "700",
                                                color: "@textPrimary",
                                                textAlign: "center"
                                              }
                                            ]
                                          }
                                        ]
                                      },
                                      {
                                        when: "${!data.telemetry.hasParkingSlots}",
                                        type: "Text",
                                        text: "No parking data available.",
                                        fontSize: "@textSm",
                                        color: "@textSecondary",
                                        marginTop: "8dp"
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
                        items: [
                          {
                            type: "Frame",
                            position: "absolute",
                            width: "100%",
                            height: "100%",
                            backgroundColor: "@shadowDark",
                            borderRadius: "@cardRadius",
                            left: "@shadowOffset",
                            top: "@shadowOffset"
                          },
                          {
                            type: "Frame",
                            width: "100%",
                            backgroundColor: "@cardLight",
                            borderRadius: "@cardRadius",
                            borderWidth: "3dp",
                            borderColor: "@accentBlue",
                            items: [
                              {
                                type: "Container",
                                padding: "24dp",
                                items: [
                                  {
                                    type: "Text",
                                    text: "Hourly Website Activity",
                                    fontSize: "@textLg",
                                    fontWeight: "700",
                                    color: "@textPrimary",
                                    marginBottom: "16dp"
                                  },
                                  {
                                    type: "Container",
                                    direction: "row",
                                    spacing: "16dp",
                                    when: "${data.hourly.hasActivity}",
                                    items: [
                                      {
                                        type: "Container",
                                        width: "0",
                                        grow: 1,
                                        items: [
                                          {
                                            type: "Frame",
                                            width: "100%",
                                            backgroundColor: "@cardLight",
                                            borderRadius: "14dp",
                                            borderWidth: "2dp",
                                            borderColor: "@accentOrange",
                                            items: [
                                              {
                                                type: "Container",
                                                paddingTop: "12dp",
                                                paddingBottom: "12dp",
                                                paddingLeft: "12dp",
                                                paddingRight: "12dp",
                                                items: [
                                                  {
                                                    type: "Text",
                                                    text: "Peak",
                                                    fontSize: "@textSm",
                                                    color: "@textSecondary"
                                                  },
                                                  {
                                                    type: "Text",
                                                    text: "${data.hourly.peakLabel}",
                                                    fontSize: "@textBase",
                                                    fontWeight: "700",
                                                    color: "@textPrimary"
                                                  },
                                                  {
                                                    type: "Text",
                                                    text: "${data.hourly.peakUsers} users",
                                                    fontSize: "@textSm",
                                                    color: "@textSecondary"
                                                  }
                                                ]
                                              }
                                            ]
                                          }
                                        ]
                                      },
                                      {
                                        type: "Container",
                                        width: "0",
                                        grow: 1,
                                        items: [
                                          {
                                            type: "Frame",
                                            width: "100%",
                                            backgroundColor: "@cardLight",
                                            borderRadius: "14dp",
                                            borderWidth: "2dp",
                                            borderColor: "@accentBlue",
                                            items: [
                                              {
                                                type: "Container",
                                                paddingTop: "12dp",
                                                paddingBottom: "12dp",
                                                paddingLeft: "12dp",
                                                paddingRight: "12dp",
                                                items: [
                                                  {
                                                    type: "Text",
                                                    text: "Typical",
                                                    fontSize: "@textSm",
                                                    color: "@textSecondary"
                                                  },
                                                  {
                                                    type: "Text",
                                                    text: "${data.hourly.midLabel}",
                                                    fontSize: "@textBase",
                                                    fontWeight: "700",
                                                    color: "@textPrimary"
                                                  },
                                                  {
                                                    type: "Text",
                                                    text: "${data.hourly.midUsers} users",
                                                    fontSize: "@textSm",
                                                    color: "@textSecondary"
                                                  }
                                                ]
                                              }
                                            ]
                                          }
                                        ]
                                      },
                                      {
                                        type: "Container",
                                        width: "0",
                                        grow: 1,
                                        items: [
                                          {
                                            type: "Frame",
                                            width: "100%",
                                            backgroundColor: "@cardLight",
                                            borderRadius: "14dp",
                                            borderWidth: "2dp",
                                            borderColor: "@accentPurple",
                                            items: [
                                              {
                                                type: "Container",
                                                paddingTop: "12dp",
                                                paddingBottom: "12dp",
                                                paddingLeft: "12dp",
                                                paddingRight: "12dp",
                                                items: [
                                                  {
                                                    type: "Text",
                                                    text: "Quietest",
                                                    fontSize: "@textSm",
                                                    color: "@textSecondary"
                                                  },
                                                  {
                                                    type: "Text",
                                                    text: "${data.hourly.lowestLabel}",
                                                    fontSize: "@textBase",
                                                    fontWeight: "700",
                                                    color: "@textPrimary"
                                                  },
                                                  {
                                                    type: "Text",
                                                    text: "${data.hourly.lowestUsers} users",
                                                    fontSize: "@textSm",
                                                    color: "@textSecondary"
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
                                    type: "Text",
                                    when: "${!data.hourly.hasActivity}",
                                    text: "No activity recorded today",
                                    fontSize: "@textBase",
                                    color: "@textSecondary"
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
                        items: [
                          {
                            type: "Frame",
                            position: "absolute",
                            width: "100%",
                            height: "100%",
                            backgroundColor: "@shadowDark",
                            borderRadius: "@cardRadius",
                            left: "@shadowOffset",
                            top: "@shadowOffset"
                          },
                          {
                            type: "Frame",
                            width: "100%",
                            backgroundColor: "@cardLight",
                            borderRadius: "@cardRadius",
                            borderWidth: "3dp",
                            borderColor: "@accentRed",
                            items: [
                              {
                                type: "Container",
                                padding: "24dp",
                                items: [
                                  {
                                    type: "Text",
                                    text: "IoT Sensors",
                                    fontSize: "@textLg",
                                    fontWeight: "700",
                                    color: "@textPrimary",
                                    marginBottom: "12dp"
                                  },
                                  {
                                    when: "${data.hasIotSlots}",
                                    type: "Sequence",
                                    width: "100%",
                                    data: "${data.iotSlots}",
                                    numbered: false,
                                    items: [
                                      {
                                        type: "Container",
                                        direction: "row",
                                        justifyContent: "spaceBetween",
                                        paddingTop: "8dp",
                                        paddingBottom: "8dp",
                                        items: [
                                          {
                                            type: "Text",
                                            text: "Slot ${data.slotNumber}",
                                            fontSize: "@textBase",
                                            color: "@textPrimary"
                                          },
                                          {
                                            type: "Text",
                                            text: "${data.statusText}",
                                            fontSize: "@textBase",
                                            color: "${data.statusColor}"
                                          }
                                        ]
                                      }
                                    ]
                                  },
                                  {
                                    when: "${!data.hasIotSlots}",
                                    type: "Text",
                                    text: "No sensor data available.",
                                    fontSize: "@textBase",
                                    color: "@textSecondary"
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

              buildFooterHint("@textSm")
            ]
          }
        ]
      }
    ]
  },

  graphics: sharedResources.graphics
};
