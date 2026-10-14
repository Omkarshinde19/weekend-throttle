import type { BikeType } from "../../api/types";

/**
 * Hand-drawn line silhouettes for each rider profile (lucide has no motorcycles).
 * All share a 64×40 box, wheels at the same height, so they line up in a row.
 */
const BODY: Record<BikeType, string> = {
  // low seat, raked forks, swept-back bars
  cruiser: "M13 28 L22 20 L36 20 L42 24 L50 14 M40 20 L46 12 L52 11 M22 20 Q27 15 34 17 M16 21 L24 21",
  // tucked fairing, high tail
  sports: "M13 28 L20 19 L30 17 L40 14 L49 16 L52 24 M20 19 L14 15 L22 15 M40 14 L46 11 M30 17 L36 24",
  // tall stance, beak, luggage rack
  adventure: "M13 28 L18 16 L32 15 L40 13 L48 9 L52 14 L51 28 M18 16 L10 16 L10 12 L18 12 M40 13 L44 6 M32 15 L36 24",
  // naked, flat bars
  street: "M13 28 L21 18 L34 17 L42 15 L51 28 M42 15 L44 9 L50 9 M21 18 L15 15 M28 17 L34 24",
  // step-through with floorboard
  scooter: "M14 28 L18 18 L26 18 L26 26 L42 26 L46 12 L51 28 M46 12 L42 10 M18 18 L30 18",
};

const WHEELS: Record<BikeType, [number, number]> = {
  cruiser: [7, 7],
  sports: [7, 7],
  adventure: [7.5, 8],
  street: [7, 7],
  scooter: [5.5, 5.5],
};

export function BikeIcon({ bike, size = 56 }: { bike: BikeType; size?: number }) {
  const [rb, rf] = WHEELS[bike];
  return (
    <svg
      viewBox="0 0 64 40"
      width={size}
      height={(size * 40) / 64}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx={13} cy={30} r={rb} />
      <circle cx={51} cy={30} r={rf} />
      <path d={BODY[bike]} />
    </svg>
  );
}
