# The client is generated into src/generated, and src/ and prisma/ are mounted
# over the image's: generate it here so it exists and matches the mounted
# schema. db push no longer does.
npx prisma generate
npx prisma db push
npm run start:dev
