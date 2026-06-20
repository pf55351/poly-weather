import { CityDetail } from "@/components/city-detail";

export default async function CityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CityDetail cityId={id} />;
}
