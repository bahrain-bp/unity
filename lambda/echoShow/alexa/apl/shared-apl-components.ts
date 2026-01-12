import { sharedAplResources } from "./shared-apl-resources";

export function buildHeader(options: {
  title: string;
  subtitle?: string;
  showTime?: boolean;
  showDate?: boolean;
  dateBinding?: string;
  spacing?: string;
  marginBottom?: string;
}) {
  const items: any[] = [
    {
      type: "TouchWrapper",
      width: "150dp",
      height: "64dp",
      onPress: [
        {
          type: "SendEvent",
          arguments: ["BackToHomeIntent"],
        },
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
            borderRadius: "32dp",
            left: "@shadowOffset",
            top: "@shadowOffset",
          },
          {
            type: "Frame",
            width: "100%",
            height: "100%",
            backgroundColor: "@cardLight",
            borderRadius: "32dp",
            borderWidth: "2dp",
            borderColor: "@border",
            items: [
              {
                type: "Container",
                width: "100%",
                height: "100%",
                direction: "row",
                justifyContent: "center",
                alignItems: "center",
                spacing: "10dp",
                items: [
                  {
                    type: "VectorGraphic",
                    source: "arrowLeftIcon",
                    width: "22dp",
                    height: "22dp",
                    scale: "best-fit",
                  },
                  {
                    type: "Text",
                    text: "Return",
                    fontSize: "@textBase",
                    fontWeight: "600",
                    color: "@textPrimary",
                    letterSpacing: "-0.2dp",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      type: "Container",
      grow: 1,
      items: [
        {
          type: "Text",
          text: options.title,
          fontSize: "@textXl",
          fontWeight: "700",
          color: "@textPrimary",
          letterSpacing: "-0.5dp",
        },
        ...(options.subtitle
          ? [
              {
                type: "Text",
                text: options.subtitle,
                fontSize: "@textBase",
                fontWeight: "400",
                color: "@textSecondary",
                paddingTop: "6dp",
              },
            ]
          : []),
      ],
    },
  ];

  if (options.showDate) {
    items.push({
      type: "Text",
      text: options.dateBinding ?? "${data.date}",
      fontSize: "@textLg",
      fontWeight: "600",
      color: "@textPrimary",
    });
  }

  if (options.showTime) {
    items.push({
      type: "Text",
      text: "${toUpperCase(Time.format('h:mm a', localTime))}",
      fontSize: "@textLg",
      fontWeight: "600",
      color: "@textPrimary",
      letterSpacing: "-0.2dp",
    });
  }

  return {
    type: "Container",
    width: "100%",
    direction: "row",
    alignItems: "center",
    spacing: options.spacing ?? "20dp",
    marginBottom: options.marginBottom ?? "50dp",
    items,
  };
}

export function buildFooterHint(fontSize: string = "@textBase") {
  return {
    type: "Container",
    width: "100%",
    alignItems: "center",
    marginTop: "30dp",
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
            scale: "best-fit",
          },
          {
            type: "Text",
            text: "Tap Return or say 'go back'",
            fontSize,
            fontWeight: "400",
            color: "@textTertiary",
            textAlign: "center",
          },
        ],
      },
    ],
  };
}

export const sharedResources = sharedAplResources;
