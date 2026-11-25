import {
  Baby, Blocks, Building2, Car, Carrot, Circle, Coins, Fuel, Gift, GraduationCap, HeartPulse, House, KeyRound,
  Map, Microscope, Milk, PartyPopper, Pencil, PiggyBank, Pill, Plane, Puzzle, Shield, Shirt, ShoppingBasket,
  ShoppingCart, Smartphone, SprayCan, Stethoscope, Trophy, Utensils, Wifi, Wrench, Zap, type LucideIcon,
} from 'lucide-react';

/** Icon names used by categories (seeded or custom). Unknown names fall back to a plain circle. */
const ICONS: Record<string, LucideIcon> = {
  baby: Baby, blocks: Blocks, 'building-2': Building2, car: Car, carrot: Carrot, coins: Coins, fuel: Fuel,
  gift: Gift, 'graduation-cap': GraduationCap, 'heart-pulse': HeartPulse, house: House, 'key-round': KeyRound,
  map: Map, microscope: Microscope, milk: Milk, 'party-popper': PartyPopper, pencil: Pencil,
  'piggy-bank': PiggyBank, pill: Pill, plane: Plane, puzzle: Puzzle, shield: Shield, shirt: Shirt,
  'shopping-basket': ShoppingBasket, 'shopping-cart': ShoppingCart, smartphone: Smartphone,
  'spray-can': SprayCan, stethoscope: Stethoscope, trophy: Trophy, utensils: Utensils, wifi: Wifi,
  wrench: Wrench, zap: Zap,
};

export const CATEGORY_ICON_NAMES = Object.keys(ICONS);

interface Props {
  name: string;
  size?: number;
}

/** Category icon; inherits the current text colour, so it follows the theme. */
export function CategoryIcon({ name, size = 22 }: Props) {
  const Icon = ICONS[name] ?? Circle;
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}
