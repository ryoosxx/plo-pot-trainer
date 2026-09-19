import { formatChips } from '../../lib/format';
import { seatDisplayName } from '../../lib/seats';
import { strings } from '../../lib/strings';
import type { Chips, Seat, SeatId } from '../../domain/types';

/** SB から時計回り。ディーラーはテーブル下側。 */
const CLOCKWISE_FROM_SB: readonly SeatId[] = [
  'SB',
  'BB',
  'STR',
  'UTG',
  'UTG1',
  'MP',
  'LJ',
  'HJ',
  'CO',
  'BTN',
];

const CX = 187;
const CY = 80;
const RX = 132;
const RY = 54;

export interface PokerTableProps {
  seats: readonly Seat[];
  contributions: Partial<Record<SeatId, Chips>>;
  heroSeat: SeatId;
  potBefore?: Chips;
  highlightActing?: boolean;
}

function rankOf(id: SeatId): number {
  const index = CLOCKWISE_FROM_SB.indexOf(id);
  return index < 0 ? CLOCKWISE_FROM_SB.length : index;
}

function sortDealerView(seats: readonly Seat[]): Seat[] {
  return [...seats].sort((a, b) => rankOf(a.id) - rankOf(b.id));
}

/** 下側にディーラーの隙間を残し、SB を左下から時計回りに置く。 */
function angleDeg(index: number, count: number): number {
  if (count <= 1) return 130;
  const start = 130;
  const sweep = 280;
  return start + (sweep * index) / (count - 1);
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function pointOn(deg: number): { x: number; y: number } {
  const a = rad(deg);
  return {
    x: CX + RX * Math.cos(a),
    y: CY + RY * Math.sin(a),
  };
}

function towardCenter(x: number, y: number, t: number): { x: number; y: number } {
  return {
    x: x + (CX - x) * t,
    y: y + (CY - y) * t,
  };
}

function awayFromCenter(x: number, y: number, t: number): { x: number; y: number } {
  return {
    x: x - (CX - x) * t,
    y: y - (CY - y) * t,
  };
}

export function PokerTable({
  seats,
  contributions,
  heroSeat,
  potBefore = 0,
  highlightActing = true,
}: PokerTableProps) {
  const ordered = sortDealerView(seats);
  const seatIds = ordered.map((seat) => seat.id);
  return (
    <svg
      data-testid="poker-table"
      viewBox="0 0 375 156"
      className="w-full h-auto"
      role="img"
      aria-label={strings.quiz.table}
    >
      <rect width="375" height="156" fill="#FFFFFF" />
      <ellipse cx={CX} cy={CY} rx="108" ry="42" fill="none" stroke="#E4E4E4" strokeWidth="1.5" />
      <ellipse cx={CX} cy={CY} rx="102" ry="38" fill="#F5F5F5" stroke="#E4E4E4" />
      {potBefore > 0 ? (
        <text
          x={CX}
          y={CY + 4}
          textAnchor="middle"
          fill="#171717"
          fontSize="12"
          fontWeight="700"
        >
          {formatChips(potBefore)}
        </text>
      ) : null}
      {ordered.map((seat, index) => {
        const pos = pointOn(angleDeg(index, ordered.length));
        const cards = towardCenter(pos.x, pos.y, 0.18);
        const amountAt = towardCenter(pos.x, pos.y, 0.5);
        const buttonAt = towardCenter(pos.x, pos.y, 0.28);
        const labelAt = awayFromCenter(pos.x, pos.y, 0.14);
        const amount = contributions[seat.id] ?? 0;
        const hero =
          highlightActing && (seat.isHero || seat.id === heroSeat);
        const folded = seat.folded;
        const button = seat.isButton || seat.id === 'BTN';
        return (
          <g
            key={seat.id}
            data-testid={`table-seat-${seat.id}`}
            data-hero={hero ? 'true' : 'false'}
            data-label={seat.label}
            opacity={folded ? 0.38 : 1}
          >
            {hero ? (
              <circle
                cx={pos.x}
                cy={pos.y - 8}
                r="15"
                fill="none"
                stroke="#171717"
                strokeWidth="2"
              />
            ) : null}
            <circle cx={pos.x} cy={pos.y - 11} r="6" fill="#8A8A8A" />
            <path
              d={`M ${pos.x - 10} ${pos.y - 4} a 10 7 0 0 0 20 0`}
              fill="#8A8A8A"
            />
            <g transform={`translate(${cards.x} ${cards.y})`}>
              <rect
                x="-9"
                y="-2"
                width="10"
                height="13"
                rx="1.5"
                fill={folded ? '#E8E8E8' : '#D8D8D8'}
                stroke={folded ? '#D0D0D0' : '#BDBDBD'}
                transform="rotate(-16)"
              />
              <rect
                x="-1"
                y="-2"
                width="10"
                height="13"
                rx="1.5"
                fill={folded ? '#EFEFEF' : '#C8C8C8'}
                stroke={folded ? '#D8D8D8' : '#B0B0B0'}
                transform="rotate(12)"
              />
            </g>
            {amount > 0 ? (
              <text
                data-testid={`table-amount-${seat.id}`}
                x={amountAt.x}
                y={amountAt.y + 4}
                textAnchor="middle"
                fill="#171717"
                fontSize="13"
                fontWeight="700"
              >
                {formatChips(amount)}
              </text>
            ) : null}
            {button ? (
              <g data-testid="dealer-button">
                <circle cx={buttonAt.x} cy={buttonAt.y} r="8" fill="#171717" />
                <text
                  x={buttonAt.x}
                  y={buttonAt.y + 3.5}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="800"
                >
                  {strings.quiz.dealerButton}
                </text>
              </g>
            ) : null}
            <text
              x={labelAt.x}
              y={labelAt.y + 12}
              textAnchor="middle"
              fill={hero ? '#171717' : '#737373'}
              fontSize="9"
              fontWeight="700"
            >
              {hero
                ? `${strings.quiz.hero} (${seatDisplayName(seat.id, seatIds)})`
                : seatDisplayName(seat.id, seatIds)}
            </text>
            <text
              data-testid={`table-stack-${seat.id}`}
              x={labelAt.x}
              y={labelAt.y + 22}
              textAnchor="middle"
              fill="#737373"
              fontSize="8"
              fontWeight="600"
            >
              {formatChips(seat.stack - amount > 0 ? seat.stack - amount : 0)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
