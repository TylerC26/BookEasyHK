This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Supabase Setup

Create a `.env.local` file with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then run the SQL in [`supabase-schema.sql`](/Users/tylerc26/Dev/BookEasyHK/supabase-schema.sql) inside the Supabase SQL Editor.

### Storage Setup For Business Images

The app is now prepared for a public storage bucket named `business-images` with:

- max file size: `5 MB`
- allowed types: `image/jpeg`, `image/png`, `image/webp`
- path format: `{businessId}/{kind}/{uuid}-{filename}`
- supported kinds: `logo`, `storefront`

The storage helper lives in [`src/lib/supabase/storage.ts`](/Users/tylerc26/Dev/BookEasyHK/src/lib/supabase/storage.ts) and can be reused when the upload UI is added later.

After you apply the schema, verify in Supabase:

1. Open `Storage` and confirm the `business-images` bucket exists.
2. Check that the bucket is `Public`.
3. Open `Policies` for `storage.objects` and confirm the business image policies were created.
4. Test with an authenticated owner account later by uploading only into that business's folder prefix.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
