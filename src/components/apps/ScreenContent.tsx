import React, { Suspense, lazy } from "react";
import type { Screen } from "../../types/riftCity";
import type { useRiftCity } from "../../hooks/useRiftCity";

type RiftCityGame = ReturnType<typeof useRiftCity>;
type ScreenContentProps = { g: RiftCityGame };
type PageComponent = React.ComponentType<ScreenContentProps>;

const PAGE_COMPONENTS: Record<Screen, React.LazyExoticComponent<PageComponent>> = {
  character: lazy(() => import("../../pages/CharacterPage")),
  city: lazy(() => import("../../pages/CityPage")),
  crimes: lazy(() => import("../../pages/CrimesPage")),
  combat: lazy(() => import("../../pages/CombatPage")),
  gym: lazy(() => import("../../pages/GymPage")),
  jobs: lazy(() => import("../../pages/JobsPage")),
  inventory: lazy(() => import("../../pages/InventoryPage")),
  shops: lazy(() => import("../../pages/ShopsPage")),
  missions: lazy(() => import("../../pages/MissionsPage")),
  education: lazy(() => import("../../pages/EducationPage")),
  property: lazy(() => import("../../pages/PropertyPage")),
  market: lazy(() => import("../../pages/MarketPage")),
  faction: lazy(() => import("../../pages/FactionPage")),
  awards: lazy(() => import("../../pages/AwardsPage")),
  progression: lazy(() => import("../../pages/ProgressionPage")),
  bank: lazy(() => import("../../pages/BankPage")),
  hospital: lazy(() => import("../../pages/HospitalPage")),
  jail: lazy(() => import("../../pages/JailPage")),
  police: lazy(() => import("../../pages/PolicePage")),
  pharmacy: lazy(() => import("../../pages/PharmacyPage")),
  casino: lazy(() => import("../../pages/CasinoPage")),
  nightclub: lazy(() => import("../../pages/NightclubPage")),
  blackmarket: lazy(() => import("../../pages/BlackMarketPage")),
  park: lazy(() => import("../../pages/ParkPage")),
  downtown: lazy(() => import("../../pages/DowntownPage")),
  airport: lazy(() => import("../../pages/AirportPage")),
};

export function ScreenContent({ g }: ScreenContentProps) {
  const Page = PAGE_COMPONENTS[g.currentScreen];
  return (
    <Suspense fallback={<div className="route-loading" role="status">Loading {g.currentScreen}…</div>}>
      <Page g={g} />
    </Suspense>
  );
}
