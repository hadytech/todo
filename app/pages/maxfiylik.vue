<script setup lang="ts">
/**
 * What this site keeps, and what it refuses to.
 *
 * Written as a page rather than a paragraph in the footer because the
 * answers are specific and checkable: each claim below corresponds to
 * something in the schema or a module in this repository, and the whole
 * repository is public. A privacy page that cannot be checked against the
 * code is a promise; this one is a description.
 */
useHead({
  title: 'Maxfiylik | yalp.uz',
  meta: [{
    name: 'description',
    content: 'yalp.uz nimani saqlaydi va nimani saqlamaydi. Manzil saqlanmaydi, kuzatuv yöq.',
  }],
})

const REPO = 'https://github.com/hadytech/todo'
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-4">
    <h1 class="text-2xl font-bold">Maxfiylik</h1>
    <p class="mt-2 text-muted">
      Qisqasi: baho va şarh yoziş uçun hisob kerak emas, IP manzilingiz
      saqlanmaydi, sayt uçinçi tomonga hiç narsa yubormaydi.
    </p>

    <section class="mt-8">
      <h2 class="font-semibold text-lg">Şarh yozganingizda</h2>
      <dl class="mt-3 space-y-4 text-sm leading-relaxed">
        <div>
          <dt class="font-medium">Saqlanadi</dt>
          <dd class="text-muted">
            Bahoyingiz, matningiz, sana va — agar yozsangiz — ismingiz.
            Ism tekşirilmaydi, şuning uçun şarh yonida
            <span class="rounded-pill border border-line px-1.5 py-0.5 text-xs">mehmon</span>
            deb turadi.
          </dd>
        </div>
        <div>
          <dt class="font-medium">Sizni nima belgilaydi</dt>
          <dd class="text-muted">
            Faqat bitta tasodifiy kalit — brauzeringizdagi cookie. U
            qurilmangiz, ekraningiz yoki manzilingizdan kelib çiqmaydi,
            şuning uçun u «barmoq izi» emas va öçirilgandan keyin
            qaytarib bölmaydi. Bazada faqat uning SHA-256 xeşi turadi.
            U nima uçun kerak: bir joyga bir odam bir şarh, bir şarhga bir
            ovoz — va yozganingizni keyin tahrirlaş yoki öçiriş imkoni.
          </dd>
        </div>
        <div>
          <dt class="font-medium">Faqat öqiyotgan bölsangiz</dt>
          <dd class="text-muted">
            Hiç qanday cookie berilmaydi. U faqat birinçi yozganingizda
            paydo böladi.
          </dd>
        </div>
        <div>
          <dt class="font-medium">Qaytarib olmoqçi bölsangiz</dt>
          <dd class="text-muted">
            Şarhni «Öçiriş» bilan olib taşlaysiz. Brauzer cookielarini
            taşlaş ham yetarli: sizni yozganingizga boğlaydigan boşqa hiç
            narsa yöq — demak yozganingizni sizga qaytarib boğlaydigan ham
            yöq. Buning narxi halol aytilsin: cookieni taşlasangiz, eski
            şarhingizni tahrirlaş imkoni ham ketadi.
          </dd>
        </div>
      </dl>
    </section>

    <section class="mt-8">
      <h2 class="font-semibold text-lg">IP manzil</h2>
      <p class="mt-3 text-sm leading-relaxed text-muted">
        Saqlanmaydi. Hiç qaysi jadvalda manzil uçun ustun yöq.
      </p>
      <p class="mt-2 text-sm leading-relaxed text-muted">
        Saqlanadigan narsa —
        <code class="rounded bg-raised px-1">HMAC(maxfiy kalit, kun + manzil)</code>:
        har kuni almaşadigan taxallus. U spam va bot uçun kerak — bir
        kunda qança şarh, qança taklif kelganini sanaş uçun. Uni
        teskari öqib bölmaydi, çunki HMAC kaliti bazada emas. Şuning uçun
        baza sizib ketsa ham, u yerdan hiç kimning manzili çiqmaydi. Kalit
        har kuni almaşgani uçun bir hafta oralab qilingan ikki iş bir-biri
        bilan boğlanmaydi.
      </p>
      <p class="mt-2 text-sm leading-relaxed text-muted">
        Buning körinadigan natijasi: kunlik çeklar Toşkent vaqti bilan
        yarim keçada yangilanadi, «oxirgi 24 soat» bölib emas.
      </p>
    </section>

    <section class="mt-8">
      <h2 class="font-semibold text-lg">Rasm</h2>
      <p class="mt-3 text-sm leading-relaxed text-muted">
        Telefonda olingan rasm içida Exif blok böladi, unda köpinça
        suratga olingan joyning GPS koordinatasi va kameraning seriya
        raqami turadi. Joy rasmini yuborgan odam özi qayerda turganini
        eʼlon qilişga rozi bölgan emas — şuning uçun rasm saqlanişdan
        avval barça metamaʼlumot serverda olib taşlanadi. Brauzer ham
        buni qiladi, lekin serverda qilinişi muhim: faqat brauzerga
        işonadigan kafolat kafolat emas.
      </p>
    </section>

    <section class="mt-8">
      <h2 class="font-semibold text-lg">Kuzatuv va uçinçi tomonlar</h2>
      <ul class="mt-3 space-y-2 text-sm leading-relaxed text-muted list-disc pl-5">
        <li>Reklama tarmoqlari yöq, kuzatuv pikselleri yöq.</li>
        <li>
          Sahifa yuklanganda boşqa saytdan hiç narsa çaqirilmaydi: skript ham,
          karta ham özimizda, şrift esa umuman yuklanmaydi — qurilmangizdagi
          şrift işlatiladi. Ilgari şrift Google Fonts'dan kelardi, yaʼni har
          sahifa açilganda brauzeringiz Google'ga xabar berardi; şu olib
          taşlandi.
        </li>
        <li>Analitika ölçagiçi sozlanmagan; sozlansa, u bu sahifada aytiladi.</li>
        <li>Cookie faqat ikkita, ikkovi ham özimizning: biri şarh muallifi uçun, ikkinçisi hisobga kirsangiz sessiya uçun. Hiç biri saytlar orasida kuzatmaydi.</li>
      </ul>
    </section>

    <section class="mt-8">
      <h2 class="font-semibold text-lg">Hisob — majburiy emas</h2>
      <p class="mt-3 text-sm leading-relaxed text-muted">
        Hisob oçmoqçi bölsangiz, faqat elektron poçta kerak — parol yöq,
        kiriş havolasi yuboriladi. Nima beradi: ismingiz barça
        qurilmangizda bitta böladi va cookieni taşlasangiz ham
        şarhlaringiz sizda qoladi. Nima saqlanadi: manzilingiz va
        körsatadigan ismingiz. Manzilingiz saytda hiç qaçon körinmaydi.
      </p>
    </section>

    <section class="mt-8">
      <h2 class="font-semibold text-lg">Tekşiriş</h2>
      <p class="mt-3 text-sm leading-relaxed text-muted">
        Yuqoridagi hamma gap kod bilan tekşiriladi — sayt töliq oçiq:
        jadvallar <code class="rounded bg-raised px-1">db/schema.sql</code>,
        taxallus <code class="rounded bg-raised px-1">lib/privacy.ts</code>,
        cookie <code class="rounded bg-raised px-1">server/utils/identity.ts</code>,
        rasm <code class="rounded bg-raised px-1">lib/imagemeta.ts</code>.
      </p>
      <p class="mt-3">
        <a
          :href="REPO" rel="noopener"
          class="rounded-pill border border-line px-4 py-2 text-sm hover:border-accent inline-block"
        >Kodni körish</a>
      </p>
    </section>
  </div>
</template>
