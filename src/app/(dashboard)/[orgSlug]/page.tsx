import { ChatHome } from "@/components/chat/chat-home";
import prisma from "@/lib/prisma";

export default async function DashboardPage(props: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await props.params;

  const org = await prisma.organization.findUnique({
    where: { slug: resolvedParams.orgSlug },
    include: { tags: { orderBy: { createdAt: "desc" } } }
  });

  return <ChatHome orgSlug={resolvedParams.orgSlug} tags={org?.tags || []} />;
}