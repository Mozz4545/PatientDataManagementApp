## Project Overview
Radiology Patient Management System สำหรับจัดการข้อมูลคนไข้ของแพนกรังสี

## Stack
- Frontend: Next.js App Router + Tailwind CSS
- Backend: Node.js + Express
- Database: MySQL
- Auth: JWT + bcryptjs





## Auth

- Roles: ADMIN, STAFF

## Coding Rules
- Backend: route → controller → db query
- Frontend: ทุก API call ใช้ react-query + axios ผ่าน /lib/api.ts
- Form: react-hook-form + zod เสมอ
- ห้าม call fetch โดยตรงใน component

