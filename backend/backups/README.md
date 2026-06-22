# Backups

Backup folders are written here by:

```bash
npm run backup
```

Restore after running migration:

```bash
npm run migrate
npm run restore -- backup-YYYYMMDD-HHMMSS --yes
```

Restore replaces database rows and result images, so use it only with the correct backup folder.
Audit logs are included in new backups. Backups created before the audit-log feature remain restorable and will start with an empty audit history.

The actual backup data is ignored by git.
