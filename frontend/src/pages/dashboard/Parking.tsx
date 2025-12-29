import DashboardLayout from "./DashboardLayout"
import { useEffect, useMemo, useRef, useState } from "react"
import "../../../styles/Parking.scss"

// --------------------
// Types
// --------------------
type SlotStatus = "Occupied" | "Available" | "Unknown"
type FocusFilter = "all" | SlotStatus | "Live"

type ParkingSlot = {
  slotId: string
  sensorId?: string
  distanceCm?: number
  status: SlotStatus
  updatedAt?: string
  device?: string
  animNonce?: number
  animPhase?: "enter" | "exit" | null
}

// --------------------
// Helpers
// --------------------
const computeStatusFromBridge = (bridgeStatus?: string, distanceCm?: number): SlotStatus => {
  if (bridgeStatus === "occupied") return "Occupied"
  if (bridgeStatus === "empty") return "Available"
  if (typeof distanceCm === "number") return distanceCm <= 50 ? "Occupied" : "Available"
  return "Unknown"
}

const formatTs = (iso?: string) => {
  if (!iso) return "-"
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const safeNowSeconds = () => Math.floor(Date.now() / 1000)
const animNonceNow = () => Date.now()

const TOTAL_PARKS = 17
const SENSOR_SLOTS = new Set(["P-01", "P-02", "P-03", "P-04"])

const SLOT_MAP: Record<string, Record<string, string>> = {
  "esp32-01": { "parking-1": "P-01", "parking-2": "P-02" },
  "pico-01": { "parking-1": "P-03", "parking-2": "P-04" },
}

// --------------------
// Cartoon Car
// --------------------
function CartoonCar({ variant = "slate" }: { variant?: "slate" | "blue" | "orange" }) {
  const fill =
    variant === "blue" ? "var(--car-blue)" : variant === "orange" ? "var(--car-orange)" : "var(--car-slate)"

  return (
    <svg className="car" viewBox="0 0 220 110" aria-hidden="true">
      <ellipse className="car__shadow" cx="110" cy="94" rx="74" ry="10" />
      <path
        className="car__body"
        fill={fill}
        d="M36 66c3-14 9-28 16-34 10-9 26-12 58-12 32 0 48 3 58 12 7 6 13 20 16 34l10 6c6 4 9 9 9 16v8c0 7-5 12-12 12h-10c-2 0-4-2-4-4v-6H53v6c0 2-2 4-4 4H39c-7 0-12-5-12-12v-8c0-7 3-12 9-16l10-6z"
      />
      <path className="car__roof" d="M76 26c7-6 18-9 34-9s27 3 34 9l18 22H58l18-22z" />
      <path className="car__window" d="M68 48h42l-10-22c-8 1-15 4-19 8L68 48z" />
      <path className="car__window" d="M152 48h-42l10-22c8 1 15 4 19 8l13 14z" />
      <rect className="car__bumper" x="32" y="70" width="18" height="12" rx="4" />
      <rect className="car__bumper" x="170" y="70" width="18" height="12" rx="4" />
      <path className="car__light" d="M43 66h12c2 0 4 2 4 4v6H39v-5c0-3 2-5 4-5z" />
      <path className="car__light" d="M165 66h12c2 0 4 2 4 4v6h-20v-5c0-3 2-5 4-5z" />

      <g className="car__wheel car__wheel--left">
        <circle cx="70" cy="90" r="16" />
        <circle className="car__rim" cx="70" cy="90" r="8" />
        <path className="car__spoke" d="M70 74v32" />
        <path className="car__spoke" d="M54 90h32" />
      </g>
      <g className="car__wheel car__wheel--right">
        <circle cx="150" cy="90" r="16" />
        <circle className="car__rim" cx="150" cy="90" r="8" />
        <path className="car__spoke" d="M150 74v32" />
        <path className="car__spoke" d="M134 90h32" />
      </g>
    </svg>
  )
}

// --------------------
// Create initial slots
// --------------------
const makeInitialSlots = (): ParkingSlot[] => {
  const list: ParkingSlot[] = []
  for (let i = 1; i <= TOTAL_PARKS; i++) {
    const id = `P-${String(i).padStart(2, "0")}`

    if (i <= 4) {
      list.push({ slotId: id, status: "Unknown", animNonce: 0, animPhase: null })
      continue
    }

    list.push({
      slotId: id,
      status: "Available",
      updatedAt: new Date().toISOString(),
      sensorId: "demo",
      device: "demo",
      animNonce: 0,
      animPhase: null,
    })
  }
  return list
}

const chunkRows = (arr: ParkingSlot[]) => [arr.slice(0, 6), arr.slice(6, 12), arr.slice(12)]

const Parking = () => {
  const [slots, setSlots] = useState<ParkingSlot[]>(() => makeInitialSlots())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [focus, setFocus] = useState<FocusFilter>("all")
  const [showOnlyLive, setShowOnlyLive] = useState(false)

  // store only slotId so modal stays LIVE with telemetry updates
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)

  // derive selected from slots (real-time)
  const selected = useMemo(
    () => (selectedSlotId ? slots.find((x) => x.slotId === selectedSlotId) ?? null : null),
    [slots, selectedSlotId]
  )

  // modal closing animation state
  const [closing, setClosing] = useState(false)

  const closeModal = () => {
    setClosing(true)
    setTimeout(() => {
      setSelectedSlotId(null)
      setClosing(false)
    }, 170) // must match SCSS popOut duration
  }

  // if slot disappears (edge-case), close modal safely
  useEffect(() => {
    if (selectedSlotId && !slots.some((x) => x.slotId === selectedSlotId)) {
      setSelectedSlotId(null)
    }
  }, [slots, selectedSlotId])

  const animTimersRef = useRef<Record<string, any>>({})

  const scheduleClearPhase = (slotId: string) => {
    if (animTimersRef.current[slotId]) clearTimeout(animTimersRef.current[slotId])
    animTimersRef.current[slotId] = setTimeout(() => {
      setSlots((pp) => pp.map((x) => (x.slotId === slotId ? { ...x, animPhase: null } : x)))
    }, 520)
  }

  const toggleFocus = (f: FocusFilter) => setFocus((prev) => (prev === f ? "all" : f))

  // --------------------
  // Listen to bridge messages
  // --------------------
  useEffect(() => {
    const onRealtime = (evt: Event) => {
      const detail = (evt as CustomEvent).detail
      if (!detail || detail.type !== "telemetry") return

      const payload = detail.payload || {}
      if (payload.sensor_type !== "ultrasonic") return

      const device: string | undefined = payload.device
      const sensorId: string | undefined = payload.sensor_id
      const bridgeStatus: string | undefined = payload.status
      const distance: number | undefined = payload.metrics?.distance_cm

      if (!device || !sensorId) return

      const slotId = SLOT_MAP?.[device]?.[sensorId]
      if (!slotId) return

      const nextStatus = computeStatusFromBridge(bridgeStatus, distance)

      const seconds =
        (typeof payload.ts === "number" ? payload.ts : undefined) ??
        (typeof detail.ts === "number" ? detail.ts : undefined) ??
        safeNowSeconds()

      const updatedAtIso = new Date(seconds * 1000).toISOString()

      setSlots((prev) =>
        prev.map((s) => {
          if (s.slotId !== slotId) return s

          const prevStatus = s.status

          // same status -> just update meta, don't interrupt animations
          if (prevStatus === nextStatus) {
            return {
              ...s,
              device,
              sensorId,
              distanceCm: typeof distance === "number" ? distance : s.distanceCm,
              updatedAt: updatedAtIso,
            }
          }

          const entering = prevStatus !== "Occupied" && nextStatus === "Occupied"
          const leaving = prevStatus === "Occupied" && nextStatus !== "Occupied" // Available OR Unknown

          const animPhase: ParkingSlot["animPhase"] = entering ? "enter" : leaving ? "exit" : null
          if (animPhase) scheduleClearPhase(slotId)

          return {
            ...s,
            device,
            sensorId,
            distanceCm: typeof distance === "number" ? distance : s.distanceCm,
            status: nextStatus,
            updatedAt: updatedAtIso,
            animPhase,
            animNonce: animPhase ? animNonceNow() : s.animNonce ?? 0,
          }
        })
      )
    }

    window.addEventListener("realtime-message", onRealtime as any)
    return () => window.removeEventListener("realtime-message", onRealtime as any)
  }, [])

  const stats = useMemo(() => {
    const total = TOTAL_PARKS
    const empty = slots.filter((s) => s.status === "Available").length
    const full = slots.filter((s) => s.status === "Occupied").length
    const unknown = slots.filter((s) => s.status === "Unknown").length
    const live = slots.filter((s) => SENSOR_SLOTS.has(s.slotId)).length
    return { total, empty, full, unknown, live }
  }, [slots])

  const visibleSlots = useMemo(() => {
    let list = [...slots]
    if (showOnlyLive) list = list.filter((s) => SENSOR_SLOTS.has(s.slotId))
    return list
  }, [slots, showOnlyLive])

  const rows = useMemo(() => chunkRows(visibleSlots), [visibleSlots])

  const toggleDemoSlot = (slotId: string) => {
    if (SENSOR_SLOTS.has(slotId)) return

    setSlots((prev) =>
      prev.map((s) => {
        if (s.slotId !== slotId) return s

        const next: SlotStatus = s.status === "Occupied" ? "Available" : "Occupied"
        const entering = s.status !== "Occupied" && next === "Occupied"
        const leaving = s.status === "Occupied" && next === "Available"
        const animPhase: ParkingSlot["animPhase"] = entering ? "enter" : leaving ? "exit" : null

        if (animPhase) scheduleClearPhase(slotId)

        return {
          ...s,
          status: next,
          updatedAt: new Date().toISOString(),
          sensorId: s.sensorId ?? "demo",
          device: s.device ?? "demo",
          animNonce: animNonceNow(),
          animPhase,
        }
      })
    )
  }

  const statusCards = useMemo(
    () => [
      { key: "all" as FocusFilter, label: "All", value: stats.total, hint: "Show everything", cls: "statCard--neutral" },
      { key: "Available" as FocusFilter, label: "Available", value: stats.empty, hint: "Empty parks", cls: "statCard--green" },
      { key: "Occupied" as FocusFilter, label: "Occupied", value: stats.full, hint: "Full parks", cls: "statCard--red" },
      { key: "Unknown" as FocusFilter, label: "Unknown", value: stats.unknown, hint: "No signal", cls: "statCard--gray" },
      { key: "Live" as FocusFilter, label: "Live sensor", value: stats.live, hint: "Sensor slots", cls: "statCard--blue" },
    ],
    [stats]
  )

  return (
    <DashboardLayout className="dashboard__parking" header="Parking">
      <div className="parking__topbar">
        <label className="parking__liveSwitch" role="button" tabIndex={0}>
          <input
            className="parking__liveSwitchInput"
            type="checkbox"
            checked={showOnlyLive}
            onChange={(e) => setShowOnlyLive(e.target.checked)}
          />
          <span className="parking__liveSwitchTrack" aria-hidden="true">
            <span className="parking__liveSwitchThumb" />
          </span>
          <span className="parking__liveSwitchText">Live only</span>
        </label>
      </div>

      {error && (
        <div className="dashboard__error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="parking__stats2 parking__stats2--row parking__stats2--five">
        {statusCards.map((c) => {
          const isActive = focus === c.key
          const isMuted = focus !== "all" && !isActive

          return (
            <button
              key={c.key}
              className={[
                "statCard",
                c.cls,
                isActive ? "statCard--active" : "",
                isMuted ? "statCard--muted" : "",
                "statCard--compact",
              ].join(" ")}
              onClick={() => (c.key === "all" ? setFocus("all") : toggleFocus(c.key))}
              type="button"
            >
              <div className="statCard__label">{c.label}</div>
              <div className="statCard__value">{c.value}</div>
              <div className="statCard__hint">{c.hint}</div>
            </button>
          )
        })}
      </div>

      <div className="dashboard__box parking__visual">
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center" }}>Refreshing...</div>
        ) : (
          <div className="parkingLot">
            {rows.map((row, idx) => (
              <div key={idx} className="parkingLot__rowWrap">
                <div className="parkingLot__row">
                  {row.map((s) => {
                    const isSensorControlled = SENSOR_SLOTS.has(s.slotId)
                    const isLive = isSensorControlled

                    const matchesFocus =
                    focus === "all" ||
                    (focus === "Live" && isLive) ||
                    (focus !== "Live" && s.status === (focus as SlotStatus))

                    const mutedCls = matchesFocus ? "" : "bay--muted"
                    const liveCls = isLive ? "bay--live" : ""

                    const cls =
                      s.status === "Available"
                        ? "bay bay--available"
                        : s.status === "Occupied"
                        ? "bay bay--occupied"
                        : "bay bay--unknown"

                    const variant =
                      s.device?.startsWith("esp32") ? "orange" : s.device?.startsWith("pico") ? "blue" : "slate"

                    const showCar = s.status === "Occupied" || s.animPhase === "enter" || s.animPhase === "exit"

                    return (
                      <button
                        key={s.slotId}
                        className={`${cls} ${liveCls} ${mutedCls}`}
                        onClick={() => {
                          if (!isSensorControlled) toggleDemoSlot(s.slotId)
                          setSelectedSlotId(s.slotId)
                          setClosing(false)
                        }}
                        type="button"
                      >
                        <div className="bay__header">
                          <span className="bay__id">{s.slotId}</span>
                          <span className="bay__badge">{isLive ? `${s.status} (Live)` : s.status}</span>
                        </div>

                        <div className="bay__laneMark" />

                        <div className="bay__content">
                          {showCar ? (
                            <div
                              key={`${s.slotId}-${s.animNonce ?? 0}-${s.animPhase ?? "idle"}`}
                              className={`bay__carWrap ${s.animPhase ? `bay__carWrap--${s.animPhase}` : ""}`}
                            >
                              <CartoonCar variant={variant as any} />
                            </div>
                          ) : (
                            <div className="bay__dot" />
                          )}
                        </div>

                        {typeof s.distanceCm === "number" && (
                          <div className="bay__distance">{Math.round(s.distanceCm)} cm</div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {idx < rows.length - 1 && <div className="parkingLot__lane" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* POPUP MODAL (LIVE) */}
      {selected && (
        <>
          <div className={`parkingBackdrop parkingBackdrop--open`} onClick={closeModal} />

          <div className={`parkingModal parkingModal--open ${closing ? "parkingModal--closing" : ""}`}>
            <div
              className={[
                "parkingModal__panel",
                selected.status === "Available"
                  ? "bay--available"
                  : selected.status === "Occupied"
                  ? "bay--occupied"
                  : "bay--unknown",
                SENSOR_SLOTS.has(selected.slotId) ? "bay--live" : "",
              ].join(" ")}
              role="dialog"
              aria-modal="true"
            >
              <div className="parkingModal__header">
                <div>
                  <div className="parkingModal__title">Slot Details</div>
                  <div className="parkingModal__sub">{selected.slotId}</div>
                </div>

                <button className="parkingModal__close" onClick={closeModal} aria-label="Close">
                  ✕
                </button>
              </div>

              <div className="parkingModal__content">
                <div className="parkingModal__hero">
                  {selected.status === "Occupied" ? (
                    <CartoonCar
                      variant={
                        selected.device?.startsWith("esp32")
                          ? "orange"
                          : selected.device?.startsWith("pico")
                          ? "blue"
                          : "slate"
                      }
                    />
                  ) : (
                    <div className="bay__dot" />
                  )}
                </div>

                <div className="parkingModal__details">
                  <div className="parkingModal__pillRow">
                    <span className={`pill pill--${selected.status.toLowerCase()}`}>{selected.status}</span>
                    {SENSOR_SLOTS.has(selected.slotId) && <span className="pill pill--live">LIVE</span>}
                  </div>

                  <div className="parkingModal__grid">
                    <div className="k">
                      <div className="k__label">Sensor</div>
                      <div className="k__value">{selected.sensorId ?? "-"}</div>
                    </div>
                    <div className="k">
                      <div className="k__label">Device</div>
                      <div className="k__value">{selected.device ?? "-"}</div>
                    </div>
                    <div className="k">
                      <div className="k__label">Last Update</div>
                      <div className="k__value">{formatTs(selected.updatedAt)}</div>
                    </div>
                    <div className="k">
                      <div className="k__label">Distance</div>
                      <div className="k__value">
                        {typeof selected.distanceCm === "number" ? `${Math.round(selected.distanceCm)} cm` : "-"}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}

export default Parking
