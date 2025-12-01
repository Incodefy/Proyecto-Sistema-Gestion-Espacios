Examen **Redes** **de** **Computadores**

**Integración** **práctica** **con** **Arquitectura**

**1.** **Contexto** **y** **propósito**

El presente examen final tiene como objetivo integrar los conocimientos
teóricos y prácticos desarrollados durante la asignatura Redes de
Computadores, aplicándolos en un entorno real de despliegue en la nube.

El examen se articula con la asignatura Arquitectura de Software, en la
cual los estudiantes han desarrollado un proyecto de aplicación. En esta
instancia evaluativa, cada estudiante (o grupo de trabajo) deberá
desplegar un módulo funcional de dicho proyecto en AWS (Amazon Web
Services), aplicando los contenidos abordados en el curso relacionados
con redes, seguridad y disponibilidad.

**2.** **Objetivo** **general**

Evaluar la capacidad del estudiante para diseñar, configurar y
documentar una arquitectura de red en la nube, aplicando los principios
de segmentación, seguridad, redundancia y ciberseguridad, conforme a los
contenidos trabajados en clases.

**3.** **Objetivos** **específicos**

> ● Diseñar y configurar una Virtual Private Cloud (VPC) personalizada
> en AWS.
>
> ● Crear y administrar subredes públicas y privadas dentro de la VPC.
>
> ● Configurar Security Groups para controlar el acceso a nivel de
> instancia.
>
> ● Aplicar Network Access Control Lists (NACLs) para reforzar la
> seguridad a nivel de subred.
>
> ● Implementar mecanismos de redundancia que aseguren la continuidad
> operativa ante fallas.
>
> ● Incorporar medidas básicas de ciberseguridad, considerando riesgos,
> vulnerabilidades y controles.
>
> ● Documentar la arquitectura de red implementada, justificando las
> decisiones técnicas adoptadas.

**4.** **Descripción** **general** **del** **examen**

El examen consiste en el diseño y despliegue de un módulo del proyecto
desarrollado en la asignatura Arquitectura de Software dentro de una
infraestructura de red en AWS.

El módulo seleccionado debe ser funcional y representativo (por ejemplo:
autenticación, API, módulo de gestión, base de datos o interfaz web).

El estudiante deberá implementar los elementos de red correspondientes,
asegurar su conectividad, aplicar políticas de seguridad y evidenciar su
funcionamiento.

La entrega final incluye tanto la implementación práctica en la nube
como una documentación técnica detallada que describa la configuración
realizada.

**5.** **Requisitos** **técnicos** **mínimos**

La arquitectura implementada deberá cumplir con los siguientes
elementos:

> 1\. **VPC** **personalizada** configurada con direccionamiento propio.
>
> 2\. **Subred** **pública** **y** **subred** **privada**, correctamente
> asociadas a una tabla de rutas y un Internet Gateway.
>
> 3\. **Security** **Groups** con reglas específicas para los servicios
> desplegados (SSH, HTTP, HTTPS, entre otros).
>
> 4\. **Network** **ACLs** configuradas para permitir y/o denegar
> tráfico según el diseño de seguridad.
>
> 5\. **Mecanismo** **de** **redundancia** (ejemplo: balanceador de
> carga, instancias en distintas zonas de disponibilidad o replicación
> básica).
>
> 6\. **Medidas** **de** **ciberseguridad**, tales como restricciones de
> acceso, manejo de credenciales, cifrado o políticas de roles (IAM).

**6.** **Entregables**

Cada estudiante o grupo deberá presentar:

**a)** **Informe** **técnico** **(formato** **PDF)**

El documento deberá incluir los siguientes apartados:

> ● **Introducción:** descripción del módulo desplegado y su relación
> con el proyecto original.
>
> ● **Diseño** **de** **arquitectura:** diagrama detallado con los
> componentes y conexiones dentro de la VPC.
>
> ● **Configuraciones** **de** **red:** explicación técnica de las
> subredes, tablas de rutas, gateways, grupos de seguridad y NACLs.
>
> ● **Redundancia** **implementada:** descripción de la estrategia
> utilizada para asegurar disponibilidad.
>
> ● **Medidas** **de** **ciberseguridad:** controles aplicados y
> justificación de su relevancia.
>
> ● **Evidencias:** capturas de pantalla, comandos ejecutados y
> resultados de conectividad.
>
> ● **Conclusiones:** reflexión técnica sobre la experiencia y los
> aprendizajes obtenidos.

**b)** **Demostración** **funcional**

Presentación breve (5–10 minutos) en la cual se muestre el entorno
implementado en AWS, el funcionamiento del módulo y la aplicación de los
principios de red y seguridad.

**7.** **Condiciones** **de** **ejecución**

> ● **Modalidad:** Según estructura del proyecto de Arquitectura de
> Software.
>
> ● **Entorno** **de** **trabajo:** AWS Academy Learner Lab o cuenta
> educativa personal.
>
> ● **Entrega:** archivo comprimido (informe + presentación ) a través
> de la plataforma institucional.
>
> ● **Defensa** **o** **demostración:** de acuerdo con el cronograma
> definido por el docente.
