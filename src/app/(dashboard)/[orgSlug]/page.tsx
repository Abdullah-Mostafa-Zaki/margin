import { ChatHome } from "@/components/chat/chat-home";

export default async function DashboardPage(props: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await props.params;

  return <ChatHome orgSlug={resolvedParams.orgSlug} />;
}