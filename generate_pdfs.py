from fpdf import FPDF
import os

# Create directory
output_dir = "data/pdf/real_dataset"
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 12)
        self.cell(0, 10, 'Dokumen Resmi Universitas Teknologi Nusantara (UTN)', 0, 1, 'C')
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, 'Halaman ' + str(self.page_no()) + '/{nb}', 0, 0, 'C')

def create_pdf(filename, title, sections):
    pdf = PDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # Title
    pdf.set_font('Arial', 'B', 16)
    pdf.cell(0, 10, title, 0, 1, 'C')
    pdf.ln(10)
    
    # Content
    pdf.set_font('Arial', '', 11)
    for subtitle, text in sections:
        if subtitle:
            pdf.set_font('Arial', 'B', 13)
            # Handle latin-1 encoding issue with pragmatic replacement
            subtitle = subtitle.encode('latin-1', 'replace').decode('latin-1')
            pdf.cell(0, 10, subtitle, 0, 1, 'L')
            pdf.ln(2)
        
        pdf.set_font('Arial', '', 11)
        # Normalize text for FPDF latin-1
        text = text.replace('‘', "'").replace('’', "'").replace('–', "-")
        text = text.encode('latin-1', 'replace').decode('latin-1')
        pdf.multi_cell(0, 6, text)
        pdf.ln(5)

    filepath = os.path.join(output_dir, filename)
    pdf.output(filepath, 'F')
    print(f"Created {filename}")

# DATASET REAL (Disamarkan menjadi UTN)

# 1. Sejarah (Based on UGM)
create_pdf("01_Sejarah_dan_Pendirian_UTN.pdf", "Sejarah dan Pendirian UTN", [
    ("Awal Mula Pendirian", 
     "Universitas Teknologi Nusantara (UTN) secara resmi didirikan pada tanggal 19 Desember 1949, pada masa awal revolusi kemerdekaan Indonesia. Pendirian UTN ditetapkan melalui Peraturan Pemerintah Nomor 23 Tahun 1949 tentang Peraturan Penggabungan Perguruan Tinggi menjadi Universiteit."),
    ("Filosofi Nama", 
     "Nama 'Nusantara' dipilih untuk melambangkan semangat persatuan kepulauan Indonesia dari Sabang sampai Merauke. Semangat ini diterjemahkan ke dalam jati diri UTN sebagai universitas nasional, universitas perjuangan, universitas Pancasila, universitas kerakyatan, dan universitas pusat kebudayaan."),
    ("Perkembangan Kampus", 
     "Pada masa awal berdirinya, UTN memiliki enam fakultas. Pembangunan fisik kampus terpadu dimulai pada tahun 1951 di kawasan seluas 300 hektar yang kini menjadi pusat kegiatan akademik utama. Arsitektur kampus dirancang dengan konsep 'Kampus Intelektual' yang memadukan ruang hijau dengan fasilitas modern.")
])

# 2. Visi Misi (Based on UI/UGM)
create_pdf("02_Visi_Misi_Tujuan.pdf", "Visi, Misi, dan Tujuan Strategis", [
    ("Visi", 
     "Menjadi universitas riset kelas dunia yang unggul, mandiri, dan bermartabat, serta mengabdi kepada kepentingan bangsa dan kemanusiaan dijiwai nilai-nilai Pancasila."),
    ("Misi", 
     "1. Menyelenggarakan pendidikan tinggi yang berkualitas untuk menghasilkan lulusan yang cerdas, kompetitif, dan berkarakter.\n"
     "2. Melaksanakan penelitian yang inovatif dan solutif untuk kemajuan ilmu pengetahuan dan teknologi.\n"
     "3. Melakukan pengabdian kepada masyarakat yang berdampak nyata bagi peningkatan kesejahteraan sosial."),
    ("Tujuan Strategis", 
     "- Menghasilkan lulusan yang siap kerja dan berdaya saing global.\n"
     "- Meningkatkan publikasi ilmiah di jurnal bereputasi internasional.\n"
     "- Mewujudkan tata kelola universitas yang transparan dan akuntabel (Good University Governance).")
])

# 3. Peraturan Akademik (Based on UI Regulation 2024)
create_pdf("03_Peraturan_Akademik_Sarjana.pdf", "Peraturan Akademik Program Sarjana", [
    ("Beban Studi dan Masa Studi", 
     "Beban studi program sarjana sekurang-kurangnya 144 SKS dan sebanyak-banyaknya 160 SKS. Masa studi program sarjana dijadwalkan untuk 8 semester dan dapat ditempuh dalam waktu kurang dari 8 semester dan selama-lamanya 14 semester."),
    ("Evaluasi Hasil Belajar", 
     "Evaluasi hasil belajar dilakukan setiap akhir semester. Mahasiswa dinyatakan putus studi (Drop Out) apabila:\n"
     "1. Pada akhir semester 4 tidak mencapai IPK 2.00 untuk minimal 48 SKS.\n"
     "2. Pada akhir semester 8 tidak mencapai IPK 2.00 untuk minimal 96 SKS.\n"
     "3. Tidak dapat menyelesaikan studi pada akhir semester 14."),
    ("Predikat Kelulusan", 
     "Predikat kelulusan terdiri dari:\n"
     "- Cum Laude (Dengan Pujian): IPK 3.51 - 4.00, masa studi maksimal 8 semester, tidak ada nilai C.\n"
     "- Sangat Memuaskan: IPK 2.76 - 3.50.\n"
     "- Memuaskan: IPK 2.00 - 2.75.")
])

# 4. Kode Etik (Based on Unpad)
create_pdf("04_Kode_Etik_Mahasiswa.pdf", "Kode Etik Mahasiswa UTN", [
    ("Prinsip Umum", 
     "Setiap mahasiswa wajib menjunjung tinggi kejujuran, integritas akademik, dan sopan santun. Mahasiswa dilarang melakukan plagiarisme, perjokian, dan pemalsuan dokumen akademik."),
    ("Etika dalam Perkuliahan", 
     "1. Hadir tepat waktu dan berpakaian sopan (tidak boleh memakai kaos oblong dan sandal).\n"
     "2. Menjaga ketenangan dan tidak mengganggu jalannya perkuliahan.\n"
     "3. Meminta izin kepada dosen jika harus meninggalkan kelas."),
    ("Etika Hubungan Antar Warga Kampus", 
     "Setiap mahasiswa wajib menghormati dosen, tenaga kependidikan, dan sesama mahasiswa tanpa membedakan suku, agama, ras, dan golongan. Dilarang melakukan perundungan (bullying) dan pelecehan seksual dalam bentuk apapun.")
])

# 5. Layanan Kesehatan (Based on ITB/Bumi Medika Ganesha)
create_pdf("05_Layanan_Kesehatan_dan_Konseling.pdf", "Layanan Kesehatan dan Konseling", [
    ("Pusat Layanan Kesehatan (PLK-UTN)", 
     "UTN menyediakan fasilitas kesehatan di Klinik Utama Kampus yang melayani poli umum, poli gigi, dan layanan gawat darurat. Mahasiswa aktif berhak mendapatkan subsidi biaya pengobatan sebesar Rp50.000 per kunjungan dengan menunjukkan Kartu Tanda Mahasiswa (KTM)."),
    ("Layanan Konseling Kemahasiswaan", 
     "Direktorat Kemahasiswaan menyediakan layanan konseling psikologis gratis bagi mahasiswa yang mengalami masalah akademik maupun personal. Layanan ini bersifat rahasia. Tersedia juga 'Peer Counselor' dari sesama mahasiswa yang telah terlatih."),
    ("BPJS Kesehatan", 
     "Klinik UTN bekerjasama dengan BPJS Kesehatan. Mahasiswa disarankan memindahkan faskes tingkat 1 mereka ke Klinik UTN selama masa studi.")
])

# 6. Fakultas Teknik (Based on UB)
create_pdf("06_Fakultas_Teknik_Prodi.pdf", "Profil Fakultas Teknik UTN", [
    ("Daftar Program Studi Sarjana", 
     "1. Teknik Sipil (Akreditasi Unggul)\n"
     "2. Teknik Mesin (Akreditasi Unggul)\n"
     "3. Teknik Elektro (Akreditasi Unggul)\n"
     "4. Teknik Pengairan (Satu-satunya di Indonesia)\n"
     "5. Arsitektur\n"
     "6. Perencanaan Wilayah dan Kota (PWK)\n"
     "7. Teknik Industri\n"
     "8. Teknik Kimia"),
    ("Fasilitas Laboratorium", 
     "Fakultas Teknik dilengkapi dengan 50+ laboratorium canggih, termasuk Lab Robotika, Lab Struktur, dan Lab Energi Terbarukan. Mahasiswa wajib mengikuti praktikum sesuai kurikulum masing-masing prodi.")
])

# 7. Fakultas Ekonomi (Based on UB/UI)
create_pdf("07_Fakultas_Ekonomi_Bisnis.pdf", "Profil Fakultas Ekonomi dan Bisnis", [
    ("Program Studi Unggulan", 
     "- S1 Akuntansi: Fokus pada audit, perpajakan, dan sistem informasi akuntansi.\n"
     "- S1 Manajemen: Konsentrasi Pemasaran, Keuangan, SDM, dan Operasional.\n"
     "- S1 Ilmu Ekonomi: Kajian ekonomi pembangunan dan kebijakan publik.\n"
     "- S1 Kewirausahaan: Mencetak wirausaha muda berbasis inovasi."),
    ("Kelas Internasional", 
     "FEB UTN menawarkan program Double Degree bekerjasama dengan universitas mitra di Australia dan Belanda. Mahasiswa menempuh 2 tahun di UTN dan 2 tahun di universitas mitra.")
])

# 8. Beasiswa dan UKT (General Public Uni Style)
create_pdf("08_Pedoman_Beasiswa_dan_UKT.pdf", "Pedoman UKT dan Beasiswa", [
    ("Uang Kuliah Tunggal (UKT)", 
     "Biaya pendidikan di UTN menggunakan sistem UKT yang dibagi menjadi 8 golongan berdasarkan kemampuan ekonomi orang tua:\n"
     "- Golongan 1: Rp 500.000\n"
     "- Golongan 2: Rp 1.000.000\n"
     "- Golongan 3-8: Bervariasi sesuai prodi (Range Rp 2.5jt - Rp 15jt)"),
    ("Beasiswa KIP Kuliah", 
     "Diberikan kepada mahasiswa dari keluarga kurang mampu. Bebas biaya pendidikan dan mendapatkan bantuan biaya hidup bulanan."),
    ("Beasiswa Prestasi UTN", 
     "Diberikan kepada mahasiswa dengan IPK > 3.50. Potongan UKT sebesar 50% untuk satu semester.")
])

# 9. Perpustakaan (UI Style)
create_pdf("09_Layanan_Perpustakaan.pdf", "Panduan Layanan Perpustakaan Pusat", [
    ("Jam Operasional", 
     "Senin - Jumat: 08.00 - 21.00 WIB\n"
     "Sabtu: 08.00 - 16.00 WIB\n"
     "Minggu: Tutup (Layanan Digital The Crystal of Knowledge tetap akses 24 jam)"),
    ("Koleksi dan Akses", 
     "Perpustakaan memiliki koleksi 1.5 juta buku fisik dan akses ke journal internasional (ScienceDirect, JSTOR, IEEE). Mahasiswa dapat meminjam maksimal 10 buku selama 14 hari."),
    ("Layanan Bebas Pustaka", 
     "Syarat wisuda adalah mengurus Surat Bebas Pustaka, yang menyatakan mahasiswa tidak memiliki tanggungan pinjaman buku dan telah menyerahkan softcopy skripsi ke repositori.")
])

# 10. Prosedur Cuti (UI Regulation)
create_pdf("10_Prosedur_Cuti_Akademik.pdf", "Prosedur Pengajuan Cuti Akademik", [
    ("Syarat Pengajuan", 
     "1. Telah menempuh minimal 2 semester (tahun pertama tidak boleh cuti).\n"
     "2. Tidak sedang menerima beasiswa yang melarang cuti.\n"
     "3. Bebas masalah administrasi keuangan."),
    ("Mekanisme Pengajuan", 
     "Pengajuan dilakukan melalui SIAK-NG (Sistem Informasi Akademik) pada masa registrasi. Mahasiswa wajib membayar biaya administrasi cuti sebesar 25% dari BOP/UKT semester tersebut agar status mahasiswa tetap aktif (tidak DO)."),
    ("Batas Maksimal", 
     "Cuti akademik dapat diambil maksimal 2 semester berturut-turut atau 4 semester secara akumulatif selama masa studi.")
])

# 11. Sanksi Pelanggaran (Unpad)
create_pdf("11_Sanksi_Pelanggaran.pdf", "Jenis Sanksi Pelanggaran Akademik", [
    ("Pelanggaran Ringan", 
     "Contoh: Mencontek tugas, terlambat masuk kelas >30 menit.\n"
     "Sanksi: Teguran lisan, pengurangan nilai tugas."),
    ("Pelanggaran Sedang", 
     "Contoh: Mencontek saat UTS/UAS, joki absen.\n"
     "Sanksi: Nilai E untuk mata kuliah tersebut, skorsing 1 semester."),
    ("Pelanggaran Berat", 
     "Contoh: Plagiarisme skripsi, pemalsuan ijazah/transkrip, tindak pidana di kampus.\n"
     "Sanksi: Pemberhentian tidak hormat (Drop Out/DO) dan pencabutan gelar jika sudah lulus.")
])

# 12. Kalender Akademik
create_pdf("12_Kalender_Akademik_2025.pdf", "Kalender Akademik T.A. 2025/2026", [
    ("Semester Ganjil", 
     "- Pengisian KRS: 1-15 Agustus 2025\n"
     "- Awal Perkuliahan: 25 Agustus 2025\n"
     "- UTS: 13-24 Oktober 2025\n"
     "- UAS: 15-26 Desember 2025\n"
     "- Batas Nilai Masuk: 5 Januari 2026"),
    ("Semester Genap", 
     "- Pengisian KRS: 2-13 Februari 2026\n"
     "- Awal Perkuliahan: 23 Februari 2026\n"
     "- UTS: 13-24 April 2026\n"
     "- UAS: 15-26 Juni 2026")
])

# 13. SKS dan Kurikulum (MBKM)
create_pdf("13_Panduan_MBKM.pdf", "Implementasi Merdeka Belajar Kampus Merdeka", [
    ("Hak Belajar di Luar Prodi", 
     "Mahasiswa berhak mengambil 20 SKS di prodi lain dalam satu kampus dan 40 SKS di luar kampus (Magang, Studi Independen, Pertukaran Pelajar)."),
    ("Konversi SKS", 
     "Kegiatan MBKM yang disetujui prodi akan dikonversi ke mata kuliah yang relevan atau mata kuliah pilihan, setara dengan 20 SKS per semester.")
])

# 14. Organisasi Mahasiswa
create_pdf("14_Organisasi_Kemahasiswaan.pdf", "Struktur Organisasi Kemahasiswaan", [
    ("Badan Eksekutif Mahasiswa (BEM)", 
     "Lembaga eksekutif tertinggi di tingkat universitas dan fakultas. Bertugas mengeksekusi program kerja kemahasiswaan."),
    ("Dewan Perwakilan Mahasiswa (DPM)", 
     "Lembaga legislatif yang mengawasi kinerja BEM dan menyerap aspirasi mahasiswa."),
    ("Unit Kegiatan Mahasiswa (UKM)", 
     "Wadah penyaluran minat bakat. Terdiri dari 40+ UKM antara lain: Paduan Suara, Mapala, Robotika, Pramuka, Marching Band, dan UKM Olahraga.")
])

# 15. Fasilitas Kampus Umum
create_pdf("15_Fasilitas_Kampus.pdf", "Fasilitas Umum Kampus UTN", [
    ("Transportasi Kampus", 
     "Tersedia Bis Kuning (Bikun) yang mengelilingi kampus setiap 15 menit secara gratis. Sepeda kampus juga tersedia di setiap shelter."),
    ("Ibadah", 
     "Masjid Ukhuwah Islamiyah berkapasitas 5000 jamaah terletak di pusat kampus. Tersedia juga kapel dan ruang doa bagi agama lain di Gedung Student Center."),
    ("Sport Center", 
     "Meliputi stadion sepak bola, kolam renang olympic size, lapangan tenis, dan gym indoor yang dapat diakses gratis oleh mahasiswa.")
])

print("Finished generating 15 PDF files.")
