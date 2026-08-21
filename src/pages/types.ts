import type { useRiftCity } from "../hooks/useRiftCity";
export type RiftCityGame = ReturnType<typeof useRiftCity>;
export type PageProps = { g: RiftCityGame };
