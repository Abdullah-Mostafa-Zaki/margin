import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const f = createUploadthing();

export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) throw new Error("Unauthorized");
      return { userEmail: session.user.email };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userEmail);
      console.log("file url", file.url);
      return { uploadedBy: metadata.userEmail, url: file.url };
    }),
  receiptUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 10 } })
    .middleware(async () => ({}))
    .onUploadComplete(async ({ file }) => ({ url: file.url }))
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
