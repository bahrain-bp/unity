import { sharedResources, buildFooterHint, buildHeader } from "./shared-apl-components";

export const iotSensorsDashboardDocument = {
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
        accentRed: "#EF4444",
        accentGreen: "#10B981",
        accentBlue: "#3B82F6"
      },
      dimensions: {
        ...sharedResources.dimensions,
        borderRadius: "20dp",
        spacing: "22dp",
        textSm: "16dp",
        textBase: "20dp",
        textLg: "28dp",
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
                title: "IoT Sensors",
                subtitle: "Real-time environmental data",
                showTime: true,
                spacing: "@spacing",
                marginBottom: "40dp"
              }),

              /* SENSOR GRID */
              {
                type: "Container",
                width: "100%",
                direction: "column",
                spacing: "@spacing",
                items: [
                  
                  /* ROW 1: Temperature + Humidity */
                  {
                    type: "Container",
                    width: "100%",
                    direction: "row",
                    spacing: "@spacing",
                    items: [
                      /* Temperature Card */
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
                            borderColor: "@accentRed",
                            items: [
                              {
                                type: "Container",
                                padding: "40dp",
                                alignItems: "center",
                                items: [
                                  {
                                    type: "Text",
                                    text: "TEMP",
                                    fontSize: "48dp",
                                    color: "@textPrimary"
                                  },
                                  {
                                    type: "Text",
                                    text: "${data.temperature}C",
                                    fontSize: "@text2xl",
                                    fontWeight: "700",
                                    color: "@accentRed",
                                    paddingTop: "16dp"
                                  },
                                  {
                                    type: "Text",
                                    text: "Temperature",
                                    fontSize: "@textBase",
                                    color: "@textSecondary",
                                    paddingTop: "8dp"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      
                      /* Humidity Card */
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
                                padding: "40dp",
                                alignItems: "center",
                                items: [
                                  {
                                    type: "Text",
                                    text: "HUM",
                                    fontSize: "48dp",
                                    color: "@textPrimary"
                                  },
                                  {
                                    type: "Text",
                                    text: "${data.humidity}%",
                                    fontSize: "@text2xl",
                                    fontWeight: "700",
                                    color: "@accentBlue",
                                    paddingTop: "16dp"
                                  },
                                  {
                                    type: "Text",
                                    text: "Humidity",
                                    fontSize: "@textBase",
                                    color: "@textSecondary",
                                    paddingTop: "8dp"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  
                  /* ROW 2: Parking Summary */
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
                        borderColor: "@accentGreen",
                        items: [
                          {
                            type: "Container",
                            padding: "40dp",
                            items: [
                              {
                                type: "Text",
                                text: "Parking Availability",
                                fontSize: "@textLg",
                                fontWeight: "700",
                                color: "@textPrimary",
                                marginBottom: "18dp"
                              },
                              {
                                type: "Container",
                                direction: "row",
                                justifyContent: "spaceBetween",
                                marginBottom: "18dp",
                                items: [
                                  {
                                    type: "Text",
                                    text: "Available: ${data.availableSlots}",
                                    fontSize: "@textBase",
                                    color: "@accentGreen"
                                  },
                                  {
                                    type: "Text",
                                    text: "Occupied: ${data.occupiedSlots}",
                                    fontSize: "@textBase",
                                    color: "@accentRed"
                                  },
                                  {
                                    type: "Text",
                                    text: "Total: ${data.totalSlots}",
                                    fontSize: "@textBase",
                                    color: "@textSecondary"
                                  }
                                ]
                              },
                              {
                                when: "${data.hasSlots}",
                                type: "GridSequence",
                                width: "100%",
                                height: "140dp",
                                columns: 6,
                                spacing: "10dp",
                                paddingTop: "8dp",
                                data: "${data.slots}",
                                items: [
                                  {
                                    type: "Frame",
                                    width: "64dp",
                                    height: "64dp",
                                    backgroundColor: "${data.statusColor}",
                                    borderRadius: "8dp",
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
                                when: "${!data.hasSlots}",
                                type: "Text",
                                text: "No parking data available.",
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
              },

              buildFooterHint("@textSm")
            ]
          }
        ]
      }
    ]
  },
  
  graphics: {
    ...sharedResources.graphics,
    /* DOTTED BACKGROUND */
    dottedPattern: {
      type: "AVG",
      version: "1.2",
      height: 100,
      width: 100,
      items: [
        {
          type: "group",
          data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          items: [
            {
              type: "group",
              data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
              items: [
                {
                  type: "path",
                  pathData: "M ${index * 10 + 5} ${data * 10 + 5} m -1.5, 0 a 1.5,1.5 0 1,0 3,0 a 1.5,1.5 0 1,0 -3,0",
                  fill: "#1A1D29",
                  fillOpacity: 0.12
                }
              ]
            }
          ]
        }
      ]
    }
  }
};


