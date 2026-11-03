
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const gerentes = await prisma.miembros_cooperativa.findMany({
    where: {
      rol: "GERENTE",
      activo: true,
      usuarios: {
        roles_globales: {
          some: {
            rol: "CLIENTE",
          },
        },
      },
    },
    select: {
      usuario_id: true,
      usuarios: {
        select: {
          nombres: true,
          apellidos: true,
          correo: true,
        },
      },
    },
  });

  const usuariosUnicos = [
    ...new Map(
      gerentes.map((g) => [g.usuario_id, g])
    ).values(),
  ];

  console.log(
    `Usuarios con CLIENTE y GERENTE activo: ${usuariosUnicos.length}`
  );

  for (const gerente of usuariosUnicos) {
    console.log(
      `${gerente.usuarios.nombres} ${gerente.usuarios.apellidos} - ${gerente.usuarios.correo}`
    );
  }

  if (process.env.CONFIRMAR_CORRECCION !== "SI") {
    console.log(
      "Vista previa: no se modificaron registros."
    );
    return;
  }

  for (const gerente of usuariosUnicos) {
    await prisma.$transaction(async (tx) => {
      const activo = await tx.miembros_cooperativa.count({
        where: {
          usuario_id: gerente.usuario_id,
          rol: "GERENTE",
          activo: true,
        },
      });

      if (activo === 0) return;

      await tx.roles_globales.deleteMany({
        where: {
          usuario_id: gerente.usuario_id,
          rol: "CLIENTE",
        },
      });
    });
  }

  console.log("Corrección completada.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
