# The image's client was generated when it was built, and prisma/ is mounted:
# regenerate so a schema change since then compiles. db push no longer does.
npx prisma generate
npx prisma db push
npm run start:dev
